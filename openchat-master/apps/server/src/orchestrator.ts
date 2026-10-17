import { randomUUID } from "node:crypto";
import { eq, and, inArray, sql } from "drizzle-orm";
import type { GenerationEvent, ConversationParams, ContentPart } from "@openchat/shared";
import { resolveProvider, embedText, embeddingsConfigured } from "@openchat/providers";
import { db } from "./db.js";
import { conversations, messages, userSettings, attachments, projects, artifacts as artifactsTable, artifactVersions } from "../../../drizzle/schema.js";
import { downloadFile } from "./storage.js";
import { parseArtifacts, stripArtifactsForModelContext } from "./artifact-parser.js";
import { getTool, getToolDefinitions } from "./tools/index.js";
import {
  buildToolProtocolPrompt,
  ToolProtocolStream,
  formatToolResultsForPrompt,
} from "./tools/tool-protocol.js";
import { retrieveContext } from "./project-files.js";
import { extractAndStoreMemory } from "./memory-extraction.js";

/**
 * Lightweight structured logging for the chat generation path. This path is the
 * app's black box — when a turn "goes silent" the only way to tell where it
 * stalled (DB, model request, tool call, …) is a breadcrumb trail. Kept terse
 * and on by default; the last line printed points at whatever hung or threw.
 */
function chatLog(convId: string, msg: string, extra?: Record<string, unknown>): void {
  const detail = extra && Object.keys(extra).length ? " " + JSON.stringify(extra) : "";
  console.log(`[chat ${convId.slice(0, 8)}] ${msg}${detail}`);
}

// Appended to the system prompt whenever tools are available. Capable reasoning
// models (e.g. DeepSeek) otherwise web-search reflexively — observed firing ~2
// searches per turn for many turns on a request they could answer directly,
// which feels frozen and clutters the transcript. This reins that in.
const TOOL_DISCIPLINE = `Tool-use guidelines:
- If the user asks you to build, create, code, clone, or write something, DO IT NOW using your own knowledge and the artifact format — do not web_search first. Building from your existing knowledge is expected; you don't need to research a site or library before writing code for it.
- Use web_search ONLY when the answer genuinely depends on current events or specific facts you don't know. For coding, design, writing, explanations, and general knowledge, answer directly without searching.
- Keep searches minimal: one or two focused queries at most. As soon as you can proceed, stop searching and produce the deliverable. Never repeat a search with the same or nearly-identical query.
- Don't announce "let me build this" and then stop or search again — when it's time to build, output the actual files/content in that same turn.`;

const RESPONSE_STYLE_INSTRUCTIONS: Record<string, string> = {
  concise: "Keep responses brief and to the point. Avoid unnecessary elaboration.",
  detailed:
    "Provide thorough, comprehensive responses with examples and explanations.",
  formal: "Use a formal, professional tone in all responses.",
};

export function buildSystemPrompt(
  customInstructions?: string | null,
  conversationSystemPrompt?: string | null,
  projectCustomInstructions?: string | null,
  ragContext?: Array<{ content: string; filename: string; similarity: number }>,
  memoryContext?: Array<{ content: string; similarity: number }>,
  responseStyle?: string | null,
): string {
  if (conversationSystemPrompt) {
    return conversationSystemPrompt;
  }
  let prompt = "You are a helpful assistant.";

  if (projectCustomInstructions) {
    prompt += `\n\n${projectCustomInstructions}`;
  }
  if (customInstructions) {
    prompt += `\n\n${customInstructions}`;
  }

  if (ragContext && ragContext.length > 0) {
    prompt += "\n\nThe following context was retrieved from project knowledge documents. Use it to answer the user's question when relevant, and cite the source documents using [Source: filename] references.\n\n";
    for (let i = 0; i < ragContext.length; i++) {
      const chunk = ragContext[i];
      prompt += `---\n[Source: ${chunk.filename}]\n${chunk.content}\n---\n\n`;
    }
  }

  if (memoryContext && memoryContext.length > 0) {
    prompt += "\n\nThe following facts were remembered from your previous conversations with this user. Use them to personalize your response when relevant:\n\n";
    for (const mem of memoryContext) {
      prompt += `- ${mem.content}\n`;
    }
  }

  if (responseStyle && responseStyle !== "balanced") {
    const instruction = RESPONSE_STYLE_INSTRUCTIONS[responseStyle];
    if (instruction) {
      prompt += `\n\n${instruction}`;
    }
  }

  prompt += `\n\nWhen generating substantial standalone content (documents, code files, HTML pages, SVG diagrams, Mermaid diagrams), wrap it in an artifact tag:
<oc-artifact type="TYPE" title="TITLE" language="LANG">CONTENT</oc-artifact>

Supported types: markdown, html, react, svg, mermaid, code.
The "language" attribute is optional and applies to code artifacts (e.g., language="python").
Use artifacts for content that the user would want to view, edit, or download separately.
Do NOT use artifacts for short code snippets, inline explanations, or conversational text.
For react artifacts, generate a complete self-contained HTML document using Babel standalone for JSX.

Multi-file projects: when the user asks you to build a project, app, or anything
spanning several files, emit EACH file as its own separate code artifact whose
title is the file's relative path, e.g.:
<oc-artifact type="code" title="package.json" language="json">…</oc-artifact>
<oc-artifact type="code" title="src/index.ts" language="typescript">…</oc-artifact>
Each artifact IS the file — its full contents go inside the tag. Do NOT also
paste those contents as Markdown headings or fenced code blocks in your prose;
that duplicates the file and produces nothing downloadable. Keep any prose
between artifacts to a short sentence (what the file is for).

When you use information from web search results, cite sources inline using [1], [2] style references with the source URLs.`;

  return prompt;
}

type MessageRow = {
  id: string;
  parentId: string | null;
  role: string;
  content: string;
  model: string | null;
  tokenUsage: unknown;
  toolMetadata: unknown;
  createdAt: Date;
};

type AttachmentRow = {
  id: string;
  messageId: string | null;
  filename: string;
  storageKey: string;
  mime: string;
  size: number;
  extractedText: string | null;
};

const MAX_IMAGE_TOTAL_BYTES = 15 * 1024 * 1024; // 15MB total for images

/** Build multimodal content for a message given its attachments. */
async function buildMessageContent(
  messageContent: string,
  msgAttachments: AttachmentRow[],
  supportsVision: boolean,
): Promise<string | ContentPart[]> {
  if (msgAttachments.length === 0) return messageContent;

  const parts: ContentPart[] = [{ type: "text", text: messageContent }];
  let imageBytes = 0;

  for (const att of msgAttachments) {
    if (att.mime.startsWith("image/")) {
      if (!supportsVision) {
        parts.push({
          type: "text",
          text: `[Image attached: ${att.filename} — model does not support image input]`,
        });
        continue;
      }
      if (imageBytes + att.size > MAX_IMAGE_TOTAL_BYTES) {
        parts.push({
          type: "text",
          text: `[Image attached: ${att.filename} — skipped, total image size limit exceeded]`,
        });
        continue;
      }
      try {
        const buffer = await downloadFile(att.storageKey);
        parts.push({
          type: "image",
          data: buffer.toString("base64"),
          mimeType: att.mime,
        });
        imageBytes += att.size;
      } catch {
        parts.push({
          type: "text",
          text: `[Image attached: ${att.filename} — failed to load]`,
        });
      }
    } else if (att.extractedText) {
      parts.push({
        type: "text",
        text: `[Attached: ${att.filename}]\n${att.extractedText}`,
      });
    } else {
      parts.push({
        type: "text",
        text: `[Attached: ${att.filename} (type not readable)]`,
      });
    }
  }

  return parts;
}

/** Walk from a leaf message to the root via parentId, return in chronological order. */
export async function loadActivePath(
  conversationId: string,
  leafId?: string | null,
): Promise<MessageRow[]> {
  // Load the whole conversation in one query, then walk the parent chain in
  // memory. (Previously this issued a separate query per ancestor — an N+1 that
  // added a DB round-trip per message before generation could even begin.)
  const all = (await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))) as MessageRow[];

  return walkActivePath(all, leafId);
}

/**
 * Walk a flat message list from `leafId` (or the most recent message when no
 * leaf is given) up to the root, returned in chronological order. Pure and
 * DB-free so the branching / cycle-guard logic stays unit-testable.
 */
export function walkActivePath(all: MessageRow[], leafId?: string | null): MessageRow[] {
  if (all.length === 0) return [];

  const byId = new Map(all.map((m) => [m.id, m]));
  const leaf = leafId
    ? byId.get(leafId)
    : all.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b));
  if (!leaf) return [];

  const path: MessageRow[] = [leaf];
  const visited = new Set<string>([leaf.id]);
  let current: MessageRow = leaf;
  while (current.parentId) {
    if (visited.has(current.parentId)) break; // cycle guard
    const parent = byId.get(current.parentId);
    if (!parent) break; // orphaned node
    visited.add(parent.id);
    path.push(parent);
    current = parent;
  }

  path.reverse();
  return path;
}

/** Shared logic: resolve provider, build prompt, stream, persist assistant message. */
async function* streamAndPersist(
  conv: { id: string; model: string; params: unknown; title: string | null; projectId?: string | null },
  userId: string,
  history: MessageRow[],
  parentIdForAssistant: string | null,
  signal?: AbortSignal,
): AsyncGenerator<GenerationEvent> {
  // Cap the tool/answer loop. Each pass can fire several tool calls, so the
  // ceiling on round-trips matters: 10 let a reasoner spiral into ~20 searches
  // and a minute of apparent silence. 5 keeps it responsive while still allowing
  // genuine multi-step research; the final pass withholds tools to force an answer.
  const MAX_TOOL_ITERATIONS = 5;

  // Get user settings for custom instructions
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  // Load project custom instructions if conversation belongs to a project
  let projectCustomInstructions: string | null = null;
  if (conv.projectId) {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, conv.projectId))
      .limit(1);
    projectCustomInstructions = project?.customInstructions ?? null;
  }

  // RAG retrieval: embed the last user message and search project chunks
  let ragContext: Array<{ content: string; filename: string; similarity: number }> = [];
  if (conv.projectId) {
    const lastUserMsg = [...history].reverse().find((m: MessageRow) => m.role === "user");
    if (lastUserMsg) {
      try {
        ragContext = await retrieveContext(conv.projectId, lastUserMsg.content);
      } catch (err) {
        console.error("RAG retrieval failed:", err);
      }
    }
  }

  // Memory retrieval: search user's memory items by similarity
  let memoryContext: Array<{ content: string; similarity: number }> = [];
  if (settings?.memoryEnabled && embeddingsConfigured()) {
    const lastUserMsg = [...history].reverse().find((m: MessageRow) => m.role === "user");
    if (lastUserMsg) {
      try {
        const queryEmbedding = await embedText(lastUserMsg.content);
        const results = await db.execute(sql`
          SELECT content, 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) AS similarity
          FROM memory_items
          WHERE user_id = ${userId}
          ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
          LIMIT 10
        `);
        memoryContext = (results as unknown as Array<{ content: string; similarity: number }>)
          .filter((r) => r.similarity >= 0.3);
      } catch (err) {
        console.error("Memory retrieval failed:", err);
      }
    }
  }

  const params = (conv.params ?? {}) as ConversationParams;
  const systemPrompt = buildSystemPrompt(
    settings?.customInstructions,
    params.systemPrompt,
    projectCustomInstructions,
    ragContext,
    memoryContext,
    settings?.responseStyle,
  );

  // Batch-load attachments for all messages in the history
  const messageIds = history.map((m) => m.id);
  const allAttachments: AttachmentRow[] =
    messageIds.length > 0
      ? await db
          .select()
          .from(attachments)
          .where(inArray(attachments.messageId, messageIds))
      : [];
  const attachmentsByMessage = new Map<string, AttachmentRow[]>();
  for (const att of allAttachments) {
    if (!att.messageId) continue;
    const list = attachmentsByMessage.get(att.messageId) ?? [];
    list.push(att);
    attachmentsByMessage.set(att.messageId, list);
  }

  // Check if the model supports vision
  const provider = resolveProvider(conv.model);
  chatLog(conv.id, "resolving model capabilities", { model: conv.model, provider: provider.id });
  // A slow/hanging /models endpoint must never block generation — it only feeds
  // the vision/tool capability flags, which have safe defaults.
  let modelInfo;
  try {
    const models = await provider.listModels();
    modelInfo = models.find((m) => m.id === conv.model);
  } catch (err) {
    chatLog(conv.id, "listModels failed (using defaults)", { error: String(err) });
  }
  const supportsVision = modelInfo?.supportsVision ?? false;

  // Build initial provider messages from history
  const historyProviderMessages = await Promise.all(
    history.map(async (m) => {
      const msgAttachments = attachmentsByMessage.get(m.id) ?? [];
      const strippedContent = stripArtifactsForModelContext(m.content);
      const content = await buildMessageContent(
        strippedContent,
        msgAttachments,
        supportsVision,
      );
      return {
        role: m.role as "user" | "assistant" | "system" | "tool",
        content,
        toolMetadata: m.toolMetadata as Record<string, unknown> | null | undefined,
        toolCallId: (m.toolMetadata as Record<string, unknown> | null)?.toolCallId as string | undefined,
        toolName: (m.toolMetadata as Record<string, unknown> | null)?.toolName as string | undefined,
      };
    }),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let providerMessages: any[] = [
    { role: "system", content: systemPrompt },
    ...historyProviderMessages,
  ];

  const toolDefs = getToolDefinitions();
  const supportsNativeTools = modelInfo?.supportsToolCalls ?? true;
  // Models without native function calling get a text-protocol fallback so they
  // can still use tools (web search, code) without leaking raw calls into chat.
  const useProtocol = !supportsNativeTools && toolDefs.length > 0;
  if (toolDefs.length > 0) {
    // Layer the (optional) text protocol and the always-on usage discipline
    // onto the system prompt when tools are in play.
    const withProtocol = useProtocol
      ? `${systemPrompt}\n\n${buildToolProtocolPrompt(toolDefs)}`
      : systemPrompt;
    providerMessages[0] = {
      role: "system",
      content: `${withProtocol}\n\n${TOOL_DISCIPLINE}`,
    };
  }
  let currentParentId = parentIdForAssistant;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    // On the final allowed iteration, withhold tools so the model is forced to
    // produce a natural-language answer from what it has already gathered,
    // instead of looping until the cap and erroring out.
    const allowTools = iteration < MAX_TOOL_ITERATIONS - 1;
    const passNativeTools = supportsNativeTools && allowTools && toolDefs.length > 0;
    const protocolThisPass = useProtocol && allowTools;

    let assistantContent = "";
    let reasoningContent = "";
    let inputTokens = 0;
    let outputTokens = 0;
    const collectedToolCalls: Array<{ id: string; name: string; args: unknown }> = [];
    const filter = protocolThisPass ? new ToolProtocolStream() : null;

    // On the forced final pass, tell the model to stop calling tools and deliver
    // now. Crucially we must NOT say "in plain prose" — that made the model
    // answer a "build me an app" request with a one-line intro and no code. It
    // must produce the ACTUAL deliverable, using artifacts for any files.
    const messagesForCall = allowTools
      ? providerMessages
      : [
          ...providerMessages,
          {
            role: "system",
            content:
              "Stop here — do not call or request any more tools. Using what you have already gathered, produce your COMPLETE final deliverable for the user now. If they asked you to build, create, or write something (code, files, a project, a document), output the full content this turn using the artifact format from the system prompt — one <oc-artifact> per file, with each file's entire contents inside. Do not merely describe or outline what you will do; produce the real thing now.",
          },
        ];

    chatLog(conv.id, "model request", {
      iteration,
      nativeTools: passNativeTools,
      protocol: protocolThisPass,
      maxTokens: params.maxTokens ?? null,
    });
    let sawFirstEvent = false;

    for await (const event of provider.stream({
      model: conv.model,
      messages: messagesForCall,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      ...(passNativeTools ? { tools: toolDefs } : {}),
    })) {
      if (signal?.aborted) break;
      if (!sawFirstEvent) {
        sawFirstEvent = true;
        chatLog(conv.id, "first model event", { iteration, type: event.type });
      }

      if (event.type === "text") {
        if (filter) {
          // Route text through the protocol filter so tool_call blocks never
          // reach the user — only safe prose is streamed and stored.
          const safe = filter.push(event.delta);
          if (safe) {
            assistantContent += safe;
            yield { type: "text", delta: safe };
          }
        } else {
          assistantContent += event.delta;
          yield event;
        }
        continue;
      }

      if (event.type === "reasoning") {
        reasoningContent += event.delta;
      } else if (event.type === "tool_call") {
        collectedToolCalls.push({ id: event.id, name: event.name, args: event.args });
      } else if (event.type === "usage") {
        inputTokens = event.inputTokens;
        outputTokens = event.outputTokens;
      }

      yield event;
    }

    // Flush the protocol filter: emit any trailing prose, then surface parsed
    // blocks as tool calls — same downstream handling as native tool_call.
    if (filter) {
      const tail = filter.flush();
      if (tail) {
        assistantContent += tail;
        yield { type: "text", delta: tail };
      }
      for (const pc of filter.calls) {
        const id = `call_${randomUUID()}`;
        collectedToolCalls.push({ id, name: pc.name, args: pc.args });
        yield { type: "tool_call", id, name: pc.name, args: pc.args };
      }
    }

    if (signal?.aborted) break;

    // Persist assistant message (with toolMetadata if tool calls).
    // Thinking-mode providers (DeepSeek/MiMo) require the reasoning from a
    // tool-call turn to be replayed on every later request, so keep it
    // alongside the tool calls.
    // On the final forced pass we won't execute tools, so don't persist tool
    // metadata for it (would otherwise show a phantom tool row with no result).
    const toolMetadata = allowTools && collectedToolCalls.length > 0
      ? { toolCalls: collectedToolCalls, ...(reasoningContent ? { reasoningContent } : {}) }
      : null;

    // Detect artifacts in the assistant content
    const { cleanContent, artifacts: parsedArtifacts } = parseArtifacts(assistantContent);
    const contentToStore = parsedArtifacts.length > 0 ? cleanContent : assistantContent;

    const [assistantMsg] = await db.insert(messages).values({
      conversationId: conv.id,
      parentId: currentParentId,
      role: "assistant",
      content: contentToStore || "",
      model: conv.model,
      tokenUsage: { inputTokens, outputTokens },
      toolMetadata,
    }).returning();

    currentParentId = assistantMsg.id;
    chatLog(conv.id, "turn persisted", {
      iteration,
      contentLen: contentToStore.length,
      toolCalls: collectedToolCalls.length,
      artifacts: parsedArtifacts.length,
      reasoningLen: reasoningContent.length,
      outputTokens,
    });

    // Persist artifacts and yield artifact events
    for (const parsed of parsedArtifacts) {
      const [artifact] = await db.insert(artifactsTable).values({
        messageId: assistantMsg.id,
        conversationId: conv.id,
        artifactType: parsed.artifactType,
        title: parsed.title,
        language: parsed.language ?? null,
        currentVersion: 1,
      }).returning();

      await db.insert(artifactVersions).values({
        artifactId: artifact.id,
        versionNumber: 1,
        content: parsed.content,
      });

      yield {
        type: "artifact",
        id: artifact.id,
        artifactType: parsed.artifactType,
        title: parsed.title,
        language: parsed.language,
        versionNumber: 1,
      };
    }

    // Finalize when there are no tool calls, OR on the final forced pass (tools
    // withheld). Otherwise a tool call emitted on the last iteration — including
    // one recovered from in-content markup like DeepSeek's DSML — would leave
    // the turn dangling on a tool result with no assistant answer ("finished
    // thinking, no answer shown").
    if (collectedToolCalls.length === 0 || !allowTools) {
      await db
        .update(conversations)
        .set({ activeLeafId: assistantMsg.id, updatedAt: new Date() })
        .where(eq(conversations.id, conv.id));
      chatLog(conv.id, "finalized", {
        iteration,
        empty: contentToStore.trim().length === 0 && parsedArtifacts.length === 0,
      });
      return;
    }

    // Execute each tool call and persist tool result messages
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolResultMessages: any[] = [];
    const executedResults: Array<{ name: string; content: string }> = [];
    chatLog(conv.id, "executing tools", { names: collectedToolCalls.map((t) => t.name) });

    for (const tc of collectedToolCalls) {
      const tool = getTool(tc.name);
      let result: string;
      let isError = false;

      if (!tool) {
        result = JSON.stringify({ error: `Unknown tool: ${tc.name}` });
        isError = true;
      } else {
        const startedAt = Date.now();
        try {
          result = await tool.execute(
            tc.args as Record<string, unknown>,
            { conversationId: conv.id, userId, signal },
          );
        } catch (err) {
          result = JSON.stringify({ error: String(err) });
          isError = true;
        }
        chatLog(conv.id, "tool done", { name: tc.name, ms: Date.now() - startedAt, isError });
      }

      // Persist tool result message
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolRows: any[] = await db.insert(messages).values({
        conversationId: conv.id,
        parentId: currentParentId,
        role: "tool",
        content: result,
        toolMetadata: { toolCallId: tc.id, toolName: tc.name },
      }).returning();
      const toolMsg = toolRows[0] as { id: string };

      currentParentId = toolMsg.id;

      // Yield tool_result event for client display
      yield {
        type: "tool_result",
        toolCallId: tc.id,
        name: tc.name,
        result,
        isError,
      };

      toolResultMessages.push({
        role: "tool",
        content: result,
        toolCallId: tc.id,
        toolName: tc.name,
      });
      executedResults.push({ name: tc.name, content: result });
    }

    // Accumulate this turn onto the running transcript so the next iteration
    // sees every prior tool call and result. (Rebuilding from only the latest
    // turn made the model forget it had already searched and loop redundantly.)
    if (useProtocol) {
      // Protocol models don't understand tool / assistant-tool_calls message
      // roles — feed the results back as plain text instead.
      providerMessages.push(
        { role: "assistant", content: assistantContent || "" },
        { role: "user", content: formatToolResultsForPrompt(executedResults) },
      );
    } else {
      providerMessages.push(
        {
          role: "assistant",
          content: assistantContent || null,
          toolMetadata: toolMetadata,
        },
        ...toolResultMessages,
      );
    }
  }

  // Unreachable in normal flow: the final iteration runs without tools, so it
  // returns an answer via the "no tool calls" branch above. Reached only if the
  // last pass was aborted — finalize gracefully rather than surfacing an error.
  if (!signal?.aborted) {
    await db
      .update(conversations)
      .set({ activeLeafId: currentParentId, updatedAt: new Date() })
      .where(eq(conversations.id, conv.id));
  }
}

export async function* generate(
  conversationId: string,
  userContent: string,
  userId: string,
  signal?: AbortSignal,
  parentId?: string | null,
  attachmentIds?: string[],
): AsyncGenerator<GenerationEvent> {
  // 1. Load conversation and verify ownership
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);

  if (!conv) {
    yield { type: "error", message: "Conversation not found" };
    return;
  }
  chatLog(conversationId, "generate", { model: conv.model, contentLen: userContent.length });

  // 2. Insert user message with parentId
  const [userMsg] = await db.insert(messages).values({
    conversationId,
    parentId: parentId ?? null,
    role: "user",
    content: userContent,
  }).returning();

  // 3. Link attachments to the user message
  if (attachmentIds?.length) {
    await db
      .update(attachments)
      .set({ messageId: userMsg.id })
      .where(inArray(attachments.id, attachmentIds));
  }

  // Update activeLeafId to the user message
  await db
    .update(conversations)
    .set({ activeLeafId: userMsg.id, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  // 4. Load active path (includes the just-inserted user message)
  const history = await loadActivePath(conversationId, userMsg.id);

  // 5. Stream, persist assistant message
  yield* streamAndPersist(conv, userId, history, userMsg.id, signal);

  // 6. Auto-generate title from first user message if title is null
  if (!conv.title) {
    const title = userContent.length > 50 ? userContent.slice(0, 50) + "..." : userContent;
    await db
      .update(conversations)
      .set({ title })
      .where(eq(conversations.id, conversationId));
  }

  // 7. Extract memory from conversation (fire-and-forget)
  // TODO(phase-8-followup): move to BullMQ for retries/durability
  if (!conv.incognito) {
    const memoryMessages = history.map((m) => ({ role: m.role, content: m.content }));
    extractAndStoreMemory(userId, conversationId, memoryMessages).catch((err) => {
      console.error(`Memory extraction failed for conversation ${conversationId}:`, err);
    });
  }
}

/** Regenerate: create a new assistant response for an existing user message. */
export async function* regenerate(
  conversationId: string,
  userMessageId: string,
  userId: string,
  signal?: AbortSignal,
): AsyncGenerator<GenerationEvent> {
  // 1. Load conversation and verify ownership
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);

  if (!conv) {
    yield { type: "error", message: "Conversation not found" };
    return;
  }

  // 2. Load history up to and including the user message
  const history = await loadActivePath(conversationId, userMessageId);
  if (history.length === 0) {
    yield { type: "error", message: "Message not found" };
    return;
  }

  // 3. Stream new assistant response, parentId = the user message (sibling of original assistant)
  yield* streamAndPersist(conv, userId, history, userMessageId, signal);
}
