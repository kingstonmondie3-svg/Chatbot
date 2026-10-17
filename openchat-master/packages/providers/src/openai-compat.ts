import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import type {
  ModelInfo,
  GenerationRequest,
  GenerationEvent,
} from "@openchat/shared";
import { LeakedToolCallStream } from "./leaked-tool-calls.js";

/**
 * Shared engine for every OpenAI-compatible provider (OpenAI, DeepSeek, MiMo,
 * OpenRouter, …). Keeping the message mapping, streaming loop, and live model
 * discovery in one place means a fix or capability lands for all of them at
 * once instead of drifting across four near-identical copies.
 */

/** Map our provider-agnostic messages into OpenAI Chat Completions shape. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toOpenAIMessages(req: GenerationRequest): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return req.messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool" as const,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        tool_call_id: m.toolCallId,
      };
    }
    if (m.role === "assistant" && m.toolMetadata?.toolCalls?.length) {
      return {
        role: "assistant" as const,
        content: typeof m.content === "string" ? m.content || null : null,
        // Thinking-mode providers (DeepSeek/MiMo) require the tool-call turn's
        // reasoning to be replayed, or the API rejects the request. Harmless for
        // providers that never set it.
        ...(m.toolMetadata.reasoningContent
          ? { reasoning_content: m.toolMetadata.reasoningContent }
          : {}),
        tool_calls: m.toolMetadata.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args),
          },
        })),
      };
    }
    if (typeof m.content === "string") {
      return { role: m.role, content: m.content };
    }
    return {
      role: m.role,
      content: m.content.map((p) =>
        p.type === "text"
          ? { type: "text" as const, text: p.text }
          : {
              type: "image_url" as const,
              image_url: { url: `data:${p.mimeType};base64,${p.data}` },
            },
      ),
    };
  });
}

/**
 * Yield a single clean error event when a provider has no API key configured.
 * Without this the underlying SDK throws "Missing credentials" from the client
 * constructor — which happens *before* the streaming try/catch — surfacing a
 * raw stack trace to the user instead of an actionable message.
 */
export async function* missingKeyError(providerName: string, envVar: string): AsyncIterable<GenerationEvent> {
  yield {
    type: "error",
    message: `${providerName} is not configured. Set ${envVar} in your .env and restart the server.`,
  };
}

/** Stream a chat completion from any OpenAI-compatible endpoint. */
export async function* streamOpenAICompatible(
  client: OpenAI,
  req: GenerationRequest,
): AsyncIterable<GenerationEvent> {
  try {
    const messages = toOpenAIMessages(req);

    const tools = req.tools?.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const stream = await client.chat.completions.create({
      model: req.model,
      messages: messages as OpenAI.ChatCompletionMessageParam[],
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      stop: req.stop,
      stream: true,
      stream_options: { include_usage: true },
      ...(tools?.length ? { tools } : {}),
    });

    let inputTokens = 0;
    let outputTokens = 0;
    let finishReason: string | null = null;
    const toolCallAccumulator = new Map<
      number,
      { id: string; name: string; args: string }
    >();
    // Catches tool calls a model emits as in-content markup (e.g. DeepSeek's
    // DSML tokens) instead of the standard tool_calls field, so they don't leak
    // into the transcript as raw text.
    const leak = new LeakedToolCallStream();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      const chunkFinish = chunk.choices[0]?.finish_reason;

      if (delta?.content) {
        const safe = leak.push(delta.content);
        if (safe) yield { type: "text", delta: safe };
      }

      // reason: reasoning_content is a thinking-mode extension absent from the OpenAI SDK delta type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reasoningDelta = (delta as any)?.reasoning_content as string | undefined;
      if (reasoningDelta) {
        yield { type: "reasoning", delta: reasoningDelta };
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          const existing = toolCallAccumulator.get(idx);
          if (existing) {
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) existing.args += tc.function.arguments;
          } else {
            toolCallAccumulator.set(idx, {
              id: tc.id ?? "",
              name: tc.function?.name ?? "",
              args: tc.function?.arguments ?? "",
            });
          }
        }
      }

      if (chunkFinish) {
        finishReason = chunkFinish;
      }

      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens;
        outputTokens = chunk.usage.completion_tokens;
      }
    }

    // Emit any prose held back while scanning for an in-content tool-call block.
    const leakTail = leak.flush();
    if (leakTail) yield { type: "text", delta: leakTail };

    if (finishReason === "tool_calls") {
      for (const tc of toolCallAccumulator.values()) {
        let parsedArgs: unknown;
        try {
          parsedArgs = JSON.parse(tc.args);
        } catch {
          parsedArgs = tc.args;
        }
        yield { type: "tool_call", id: tc.id, name: tc.name, args: parsedArgs };
      }
    }

    // Tool calls the model emitted as in-content markup (DeepSeek DSML, etc.).
    for (const c of leak.calls) {
      yield { type: "tool_call", id: `dsml_${randomUUID()}`, name: c.name, args: c.args };
    }

    if (finishReason) {
      yield { type: "done", finishReason };
    }

    yield { type: "usage", inputTokens, outputTokens };
  } catch (err) {
    yield { type: "error", message: String(err) };
  }
}

// --- Live model discovery ------------------------------------------------

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("model list timeout")), ms),
    ),
  ]);
}

/**
 * Ask an OpenAI-compatible `/models` endpoint for its current catalog. Returns
 * `null` (rather than throwing) on any failure so callers can fall back to a
 * curated list and the models endpoint never hangs on a slow provider.
 */
export async function fetchLiveModelIds(
  client: OpenAI,
  timeoutMs = 4000,
): Promise<string[] | null> {
  try {
    const page = await withTimeout(client.models.list(), timeoutMs);
    const ids = page.data.map((m) => m.id).filter(Boolean);
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}

/**
 * Reconcile the provider's *live* catalog with our curated metadata. The live
 * list is the source of truth: only models the provider is actually serving are
 * returned, so stale hardcoded entries never linger. Curated entries supply the
 * rich capability metadata (context window, vision, tool support) the bare
 * `/models` ids lack, and define a friendly ordering for the common models;
 * any extra live ids are appended with sensible defaults. With no live data
 * (offline / no key) the curated list is returned verbatim as a fallback.
 */
export function buildModelList(opts: {
  curated: ModelInfo[];
  liveIds: string[] | null;
  defaults: Omit<ModelInfo, "id" | "name">;
  filter?: (id: string) => boolean;
  nameFor?: (id: string) => string;
}): ModelInfo[] {
  const { curated, liveIds, defaults, filter, nameFor } = opts;
  if (!liveIds) return curated;

  const liveSet = new Set(liveIds.filter((id) => (filter ? filter(id) : true)));
  const curatedById = new Map(curated.map((m) => [m.id, m]));

  // Curated models that are actually live, in curated order.
  const ordered = curated.filter((m) => liveSet.has(m.id));
  const seen = new Set(ordered.map((m) => m.id));

  // Any live models we don't have curated metadata for, alphabetically.
  const extra = [...liveSet]
    .filter((id) => !seen.has(id))
    .sort((a, b) => a.localeCompare(b))
    .map<ModelInfo>(
      (id) => curatedById.get(id) ?? { id, name: nameFor ? nameFor(id) : id, ...defaults },
    );

  return [...ordered, ...extra];
}

// --- Result caching ------------------------------------------------------

const modelCache = new Map<string, { at: number; data: ModelInfo[] }>();

/**
 * Cache a provider's model list for `ttlMs`. On refresh failure the last good
 * value is served stale rather than surfacing an error to the picker.
 */
export async function withModelCache(
  key: string,
  ttlMs: number,
  fn: () => Promise<ModelInfo[]>,
): Promise<ModelInfo[]> {
  const hit = modelCache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  try {
    const data = await fn();
    modelCache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    return hit?.data ?? [];
  }
}
