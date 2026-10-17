import { useEffect, useMemo, useRef, useState } from "react";
import { useChatStore, getVariantInfo } from "../stores/chat";
import { useConversationsStore } from "../stores/conversations";
import { useArtifactsStore } from "../stores/artifacts";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ModelPicker } from "./ModelPicker";
import { ParamsPanel } from "./ParamsPanel";
import { ToolCallGroup, type ToolCall } from "./ToolCallGroup";
import { exportConversation, stripArtifactsForDisplay } from "../lib/artifacts";
import type { ConversationParams } from "../stores/conversations";

interface ChatViewProps {
  conversationId: string;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface ConversationArtifact {
  id: string;
  messageId: string;
  artifactType: string;
  title: string;
  currentVersion: number;
}

// Stable reference for messages with no artifacts, so memoized MessageBubbles
// don't re-render just because an empty array was recreated.
const EMPTY_ARTIFACTS: ConversationArtifact[] = [];

/** Extract citation URLs from web_search tool results following an assistant message. */
function extractCitations(
  messages: Array<{ id: string; role: string; content: string; toolMetadata?: Record<string, unknown> | null }>,
  assistantMessageId: string,
): Record<number, string> {
  const citations: Record<number, string> = {};
  // Find tool result messages that follow this assistant message
  const assistantIdx = messages.findIndex((m) => m.id === assistantMessageId);
  if (assistantIdx === -1) return citations;

  let citationNum = 1;
  for (let i = assistantIdx + 1; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "tool") break;
    // Only process web_search results
    const meta = msg.toolMetadata as { toolName?: string } | null | undefined;
    if (meta?.toolName !== "web_search") continue;
    try {
      const parsed = JSON.parse(msg.content) as { results?: SearchResult[] };
      if (parsed.results) {
        for (const r of parsed.results) {
          if (r.url) {
            citations[citationNum] = r.url;
            citationNum++;
          }
        }
      }
    } catch {
      // skip malformed
    }
  }
  return citations;
}

export function ChatView({ conversationId }: ChatViewProps) {
  const {
    allMessages,
    activePath,
    isStreaming,
    streamingContent,
    streamingToolCalls,
    streamingReasoning,
    error,
    loadMessages,
    sendMessage,
    editMessage,
    regenerateMessage,
    switchVariant,
    stopGeneration,
  } = useChatStore();

  const { conversations, updateConversation } = useConversationsStore();
  const { artifactsByConversation, openArtifact, fetchArtifacts } = useArtifactsStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [showParams, setShowParams] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const conversation = conversations.find((c) => c.id === conversationId);
  const currentModel = conversation?.model ?? "nvidia/nemotron-3.5-lightning:free";
  const currentParams: ConversationParams = conversation?.params ?? {};

  const conversationArtifacts = artifactsByConversation.get(conversationId) ?? [];

  // Group artifacts by message id once per change, so each bubble receives a
  // stable array reference (required for MessageBubble's memo comparator).
  const artifactsByMessage = useMemo(() => {
    const map = new Map<string, ConversationArtifact[]>();
    for (const a of conversationArtifacts) {
      const list = map.get(a.messageId);
      if (list) list.push(a);
      else map.set(a.messageId, [a]);
    }
    return map;
  }, [conversationArtifacts]);

  // Precompute citations per assistant message; recomputes only when the thread
  // changes, not on every streaming token.
  const citationsByMessage = useMemo(() => {
    const map = new Map<string, Record<number, string>>();
    for (const m of activePath) {
      if (m.role === "assistant") map.set(m.id, extractCitations(activePath, m.id));
    }
    return map;
  }, [activePath]);

  // Map persisted tool-result messages back onto their originating tool call, so
  // a reloaded thread shows the same result cards the live stream did (the
  // assistant message's toolCalls carry no result on their own).
  const toolResultsById = useMemo(() => {
    const map = new Map<string, { content: string; isError: boolean }>();
    for (const m of activePath) {
      if (m.role !== "tool") continue;
      const id = (m.toolMetadata as { toolCallId?: string } | null | undefined)?.toolCallId;
      if (!id) continue;
      let isError = false;
      try {
        isError = typeof (JSON.parse(m.content) as { error?: unknown })?.error === "string";
      } catch {
        /* result isn't JSON — treat as success */
      }
      map.set(id, { content: m.content, isError });
    }
    return map;
  }, [activePath]);

  // Flatten the thread into render items: collapse consecutive tool calls (a
  // looping agent can fire many) into one grouped row, and drop the empty
  // assistant bubbles produced by tool-only turns — both are what made the
  // transcript look cluttered.
  type RenderItem =
    | { kind: "message"; msg: (typeof activePath)[number] }
    | { kind: "tools"; id: string; calls: ToolCall[] };

  const renderItems = useMemo<RenderItem[]>(() => {
    const items: RenderItem[] = [];
    let pending: ToolCall[] = [];
    const flush = () => {
      if (pending.length) {
        items.push({ kind: "tools", id: `tools-${pending[0].id}`, calls: pending });
        pending = [];
      }
    };
    for (const msg of activePath) {
      if (msg.role === "tool") continue;
      if (msg.role === "assistant") {
        const calls = ((msg.toolMetadata?.toolCalls ?? []) as ToolCall[]).map((c) => {
          const res = toolResultsById.get(c.id);
          return res
            ? { ...c, result: res.content, status: (res.isError ? "error" : "complete") as ToolCall["status"] }
            : c;
        });
        const hasContent = msg.content.trim().length > 0;
        if (hasContent) {
          flush();
          items.push({ kind: "message", msg });
          if (calls.length) pending.push(...calls);
        } else if (calls.length) {
          pending.push(...calls);
        } else {
          // Empty assistant turn with no tool calls — the model returned
          // nothing (error / over-long generation). Render it so the bubble can
          // surface a hint instead of silently dropping it ("no result shown").
          flush();
          items.push({ kind: "message", msg });
        }
      } else {
        flush();
        items.push({ kind: "message", msg });
      }
    }
    flush();
    return items;
  }, [activePath, toolResultsById]);

  // Compute conversation-level token totals
  const tokenTotals = activePath.reduce(
    (acc, msg) => {
      if (msg.tokenUsage) {
        acc.input += msg.tokenUsage.inputTokens;
        acc.output += msg.tokenUsage.outputTokens;
      }
      return acc;
    },
    { input: 0, output: 0 },
  );

  useEffect(() => {
    loadMessages(conversationId);
    fetchArtifacts(conversationId);
  }, [conversationId, loadMessages, fetchArtifacts]);

  // Track whether the user is parked near the bottom so we never yank them
  // down while they're scrolled up reading.
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = distanceFromBottom < 120;
    // Only surface the affordance when there's a meaningful amount scrolled away.
    setShowJumpToLatest(distanceFromBottom > 240);
  };

  const scrollToBottom = () => {
    atBottomRef.current = true;
    setShowJumpToLatest(false);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  // Streaming tokens: jump instantly (smooth-per-token is what causes jank),
  // and only when the user is already at the bottom.
  useEffect(() => {
    if (!atBottomRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [streamingContent, streamingReasoning]);

  // New messages (or opening a conversation): glide to the bottom.
  useEffect(() => {
    atBottomRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activePath.length, conversationId]);

  const handleSend = (content: string, attachmentIds?: string[]) => {
    sendMessage(conversationId, content, undefined, attachmentIds);
  };

  const handleRetry = () => {
    const lastUserMessage = [...activePath].reverse().find((m) => m.role === "user");
    if (lastUserMessage) {
      sendMessage(conversationId, lastUserMessage.content, lastUserMessage.parentId ?? undefined);
    }
  };

  const handleModelChange = (model: string) => {
    updateConversation(conversationId, { model });
  };

  const handleParamsChange = (params: ConversationParams) => {
    updateConversation(conversationId, { params });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportConversation(conversationId, conversation?.title ?? null);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative flex h-full flex-col">
      {/* Header bar */}
      <div className="flex h-14 items-center gap-3 border-b border-stone-200/80 bg-stone-50/80 px-4 backdrop-blur-sm dark:border-white/10 dark:bg-[#0e0f13]/80">
        <ModelPicker value={currentModel} onChange={handleModelChange} />
        <button
          onClick={() => setShowParams(!showParams)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            showParams
              ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
              : "text-stone-500 hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-white/5"
          }`}
          title="Generation parameters"
        >
          Params
        </button>
        {tokenTotals.input + tokenTotals.output > 0 && (
          <span className="ml-auto text-xs text-stone-400 dark:text-stone-500">
            {tokenTotals.input.toLocaleString()} in / {tokenTotals.output.toLocaleString()} out
          </span>
        )}
        <button
          onClick={handleExport}
          disabled={isExporting || activePath.length === 0}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-200/60 disabled:cursor-not-allowed disabled:opacity-40 dark:text-stone-400 dark:hover:bg-white/5 ${
            tokenTotals.input + tokenTotals.output > 0 ? "" : "ml-auto"
          }`}
          title="Export conversation as Markdown"
        >
          {isExporting ? "Exporting…" : "Export"}
        </button>
      </div>

      {/* Params panel (collapsible) */}
      {showParams && (
        <ParamsPanel params={currentParams} onChange={handleParamsChange} />
      )}

      {/* Messages area */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-6">
        {activePath.length === 0 && !isStreaming ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.2A7.94 7.94 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="font-serif text-2xl font-medium text-stone-800 dark:text-stone-100">
              How can I help you today?
            </p>
            <p className="text-sm text-stone-400 dark:text-stone-500">
              Ask anything, or attach a file to get started.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            {renderItems.map((item) => {
              if (item.kind === "tools") {
                return <ToolCallGroup key={item.id} calls={item.calls} />;
              }
              const msg = item.msg;
              const { index, total } = getVariantInfo(allMessages, msg.id);
              const messageArtifacts = artifactsByMessage.get(msg.id) ?? EMPTY_ARTIFACTS;
              return (
                <MessageBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  tokenUsage={msg.tokenUsage}
                  attachments={msg.attachments}
                  artifacts={messageArtifacts}
                  onArtifactClick={(id) => openArtifact(conversationId, id)}
                  onEdit={
                    msg.role === "user"
                      ? (newContent) => editMessage(conversationId, msg.id, newContent)
                      : undefined
                  }
                  onRegenerate={
                    msg.role === "assistant"
                      ? () => regenerateMessage(conversationId, msg.id)
                      : undefined
                  }
                  variantIndex={index}
                  variantCount={total}
                  onVariantPrev={() => switchVariant(msg.id, "prev")}
                  onVariantNext={() => switchVariant(msg.id, "next")}
                  citations={msg.role === "assistant" ? citationsByMessage.get(msg.id) : undefined}
                />
              );
            })}
            {isStreaming && (
              <>
                {/* Live chain-of-thought for thinking models (DeepSeek/MiMo). */}
                {streamingReasoning && <ReasoningPanel text={streamingReasoning} />}

                {/* Before any output (no reasoning, no tool call, no text yet)
                    show a working pulse so it's clear the model isn't frozen. */}
                {!streamingContent && !streamingReasoning && streamingToolCalls.length === 0 && (
                  <ThinkingDots />
                )}

                {/* Streaming tool calls — collapsed into one group */}
                {streamingToolCalls.length > 0 && (
                  <ToolCallGroup calls={streamingToolCalls as ToolCall[]} isStreaming />
                )}

                {/* Artifact markup is replaced with a "[Artifact: title]"
                    placeholder so the file's raw contents never flood the
                    bubble mid-stream; the real, clickable card appears once the
                    message finalizes. */}
                {(() => {
                  const display = stripArtifactsForDisplay(streamingContent).trimEnd();
                  return display ? (
                    <MessageBubble role="assistant" content={display} isStreaming />
                  ) : null;
                })()}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Jump to latest */}
      {showJumpToLatest && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-28 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 shadow-soft transition-colors hover:bg-stone-50 dark:border-white/10 dark:bg-[#1a1d23] dark:text-stone-300 dark:hover:bg-white/5"
          aria-label="Scroll to latest message"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          Latest
        </button>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-auto mb-2 flex w-full max-w-3xl items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-400">
          <span>{error}</span>
          <button
            onClick={handleRetry}
            className="ml-2 shrink-0 rounded-md px-2 py-1 font-medium hover:bg-red-100 dark:hover:bg-red-900/50"
          >
            Retry
          </button>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isStreaming={isStreaming}
        onStop={stopGeneration}
      />
    </div>
  );
}

/** Three bouncing dots — the "model is working" cue before any output arrives. */
function ThinkingDots() {
  return (
    <div className="mb-6 flex items-center gap-2 py-1 text-sm text-stone-400 dark:text-stone-500">
      <span className="flex gap-1" aria-hidden="true">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
      </span>
      Thinking…
    </div>
  );
}

/**
 * Live reasoning trace for thinking models. Auto-expanded while it streams so
 * the user sees the model is working; collapsible to keep the transcript tidy.
 * Rendered as plain pre-wrapped text (no markdown/highlight) — reasoning grows
 * every frame, so a cheap render keeps it from janking.
 */
function ReasoningPanel({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Keep the newest reasoning in view as it streams.
  useEffect(() => {
    const el = bodyRef.current;
    if (open && el) el.scrollTop = el.scrollHeight;
  }, [text, open]);

  return (
    <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50/60 dark:border-white/10 dark:bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-stone-500 transition-colors hover:bg-stone-200/40 dark:text-stone-400 dark:hover:bg-white/5"
      >
        <svg className="h-4 w-4 animate-pulse text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="font-medium">Thinking</span>
        <svg
          className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          ref={bodyRef}
          className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words border-t border-stone-200/70 px-3 py-2 text-[13px] leading-6 text-stone-500 dark:border-white/10 dark:text-stone-400"
        >
          {text}
        </div>
      )}
    </div>
  );
}
