import { create } from "zustand";
import { parseSSEStream } from "../lib/sse";
import { useArtifactsStore } from "./artifacts";

interface Attachment {
  id: string;
  filename: string;
  mime: string;
  size: number;
}

interface ToolCallRecord {
  id: string;
  name: string;
  args: unknown;
}

interface Message {
  id: string;
  parentId: string | null;
  role: string;
  content: string;
  model?: string | null;
  tokenUsage?: { inputTokens: number; outputTokens: number } | null;
  toolMetadata?: {
    toolCalls?: ToolCallRecord[];
    toolCallId?: string;
    toolName?: string;
  } | null;
  attachments?: Attachment[];
  createdAt: string;
}

interface StreamingToolCall {
  id: string;
  name: string;
  args: unknown;
  result?: string;
  isError?: boolean;
  status: "calling" | "complete" | "error";
}

interface ChatState {
  allMessages: Message[];
  activePath: Message[];
  activeLeafId: string | null;
  isStreaming: boolean;
  streamingContent: string;
  streamingToolCalls: StreamingToolCall[];
  streamingReasoning: string;
  error: string | null;

  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string, parentId?: string, attachmentIds?: string[]) => Promise<void>;
  editMessage: (conversationId: string, messageId: string, content: string) => Promise<void>;
  regenerateMessage: (conversationId: string, messageId: string) => Promise<void>;
  switchVariant: (messageId: string, direction: "prev" | "next") => void;
  stopGeneration: () => void;
  clearChat: () => void;
}

let abortController: AbortController | null = null;

/** Walk from a leaf message to root via parentId, return chronological order. */
function computeActivePath(allMessages: Message[], leafId: string | null): Message[] {
  if (!leafId || allMessages.length === 0) return [];

  const byId = new Map(allMessages.map((m) => [m.id, m]));
  const path: Message[] = [];
  const visited = new Set<string>();
  let current = byId.get(leafId);

  while (current) {
    if (visited.has(current.id)) break; // cycle guard
    visited.add(current.id);
    path.push(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  path.reverse();
  return path;
}

/** Get variant info for a specific message. */
function getVariantInfo(
  allMessages: Message[],
  messageId: string,
): { index: number; total: number; siblings: Message[] } {
  const msg = allMessages.find((m) => m.id === messageId);
  if (!msg) return { index: 0, total: 1, siblings: [] };

  const siblings = allMessages.filter(
    (m) => (m.parentId ?? "root") === (msg.parentId ?? "root") && m.role === msg.role,
  );
  const index = siblings.findIndex((m) => m.id === messageId);
  return { index: Math.max(0, index), total: siblings.length, siblings };
}

async function* streamResponse(
  url: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Request failed");
  }

  const reader = res.body?.getReader();
  if (!reader) return;

  yield* parseSSEStream(reader);
}

type SetChatState = (
  partial: Partial<ChatState> | ((state: ChatState) => Partial<ChatState>),
) => void;

/**
 * Coalesce streaming token deltas into at most one React state update per
 * animation frame. Calling `set({ streamingContent })` on every SSE delta
 * forces the whole thread to re-render (and re-parse markdown) per token, which
 * is the main source of streaming jank; batching to frame cadence keeps long
 * conversations smooth without changing what the user eventually sees.
 */
function createStreamFlusher(apply: (content: string) => void) {
  const schedule: (cb: () => void) => number =
    typeof requestAnimationFrame !== "undefined"
      ? (cb) => requestAnimationFrame(cb)
      : (cb) => setTimeout(cb, 16) as unknown as number;
  const unschedule: (handle: number) => void =
    typeof cancelAnimationFrame !== "undefined"
      ? (handle) => cancelAnimationFrame(handle)
      : (handle) => clearTimeout(handle);

  let buffer = "";
  let scheduled = false;
  let handle = 0;

  const tick = () => {
    scheduled = false;
    apply(buffer);
  };

  return {
    push(delta: string) {
      buffer += delta;
      if (!scheduled) {
        scheduled = true;
        handle = schedule(tick);
      }
    },
    get content() {
      return buffer;
    },
    /** Cancel any pending frame; safe to call multiple times. */
    stop() {
      if (scheduled) {
        unschedule(handle);
        scheduled = false;
      }
    },
  };
}

type StreamFlusher = ReturnType<typeof createStreamFlusher>;

/**
 * Drive one SSE stream: route text deltas through the frame-coalescing flusher
 * and apply tool-call / tool-result / artifact / error events to the store.
 * Shared by send / edit / regenerate so the event handling stays in one place.
 */
async function consumeStream(
  iterator: AsyncGenerator<{ data: string }>,
  conversationId: string,
  flusher: StreamFlusher,
  reasoningFlusher: StreamFlusher,
  set: SetChatState,
): Promise<"done" | "error"> {
  try {
    for await (const sseEvent of iterator) {
      if (abortController?.signal.aborted) break;

      try {
        const event = JSON.parse(sseEvent.data);

        if (event.type === "text") {
          flusher.push(event.delta);
        } else if (event.type === "reasoning") {
          // Thinking-model trace (DeepSeek/MiMo). Shown live in a collapsible
          // panel; coalesced to frame cadence like text so it can't jank.
          reasoningFlusher.push(event.delta);
        } else if (event.type === "tool_call") {
          set((state) => ({
            streamingToolCalls: [
              ...state.streamingToolCalls,
              { id: event.id, name: event.name, args: event.args, status: "calling" },
            ],
          }));
        } else if (event.type === "tool_result") {
          set((state) => ({
            streamingToolCalls: state.streamingToolCalls.map((tc) =>
              tc.id === event.toolCallId
                ? { ...tc, result: event.result, isError: event.isError, status: event.isError ? "error" : "complete" }
                : tc,
            ),
          }));
        } else if (event.type === "artifact") {
          useArtifactsStore.getState().addStreamingArtifact(conversationId, {
            id: event.id,
            messageId: "",
            conversationId,
            artifactType: event.artifactType,
            title: event.title,
            language: event.language,
            currentVersion: event.versionNumber,
            createdAt: new Date().toISOString(),
          });
        } else if (event.type === "error") {
          set({ error: event.message, isStreaming: false, streamingContent: "", streamingToolCalls: [] });
          return "error";
        }
      } catch {
        // Skip malformed events
      }
    }
    return "done";
  } finally {
    flusher.stop();
    reasoningFlusher.stop();
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  allMessages: [],
  activePath: [],
  activeLeafId: null,
  isStreaming: false,
  streamingContent: "",
  streamingToolCalls: [],
  streamingReasoning: "",
  error: null,

  loadMessages: async (conversationId) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const msgs: Message[] = data.messages ?? data;
        const leafId: string | null = data.activeLeafId ?? null;
        const activePath = computeActivePath(msgs, leafId);
        set({ allMessages: msgs, activePath, activeLeafId: leafId, error: null });
      }
    } catch {
      set({ error: "Failed to load messages" });
    }
  },

  sendMessage: async (conversationId, content, parentId, attachmentIds) => {
    const { activeLeafId } = get();
    const effectiveParentId = parentId ?? activeLeafId ?? undefined;

    // Optimistic user message
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      parentId: effectiveParentId ?? null,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      allMessages: [...state.allMessages, userMessage],
      activePath: [...state.activePath, userMessage],
      isStreaming: true,
      streamingContent: "",
      streamingToolCalls: [],
      streamingReasoning: "",
      error: null,
    }));

    abortController = new AbortController();

    const flusher = createStreamFlusher((content) => set({ streamingContent: content }));
    const reasoningFlusher = createStreamFlusher((reasoning) => set({ streamingReasoning: reasoning }));

    try {
      const result = await consumeStream(
        streamResponse(
          `/api/conversations/${conversationId}/messages`,
          { content, parentId: effectiveParentId, attachmentIds },
          abortController.signal,
        ),
        conversationId,
        flusher,
        reasoningFlusher,
        set,
      );
      if (result === "error") return;

      // Reload messages from server to get real IDs and tree state
      if (flusher.content || get().streamingToolCalls.length > 0) {
        const res = await fetch(`/api/conversations/${conversationId}/messages`);
        if (res.ok) {
          const data = await res.json();
          const msgs: Message[] = data.messages ?? data;
          const leafId: string | null = data.activeLeafId ?? null;
          const activePath = computeActivePath(msgs, leafId);
          set({
            allMessages: msgs,
            activePath,
            activeLeafId: leafId,
            isStreaming: false,
            streamingContent: "",
            streamingToolCalls: [],
          });
          useArtifactsStore.getState().fetchArtifacts(conversationId);
        }
      } else {
        set({ isStreaming: false, streamingContent: "", streamingToolCalls: [] });
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        if (flusher.content) {
          // Reload from server for consistency
          const res = await fetch(`/api/conversations/${conversationId}/messages`);
          if (res.ok) {
            const data = await res.json();
            const msgs: Message[] = data.messages ?? data;
            const leafId: string | null = data.activeLeafId ?? null;
            const activePath = computeActivePath(msgs, leafId);
            set({
              allMessages: msgs,
              activePath,
              activeLeafId: leafId,
              isStreaming: false,
              streamingContent: "",
              streamingToolCalls: [],
            });
          }
        } else {
          set({ isStreaming: false, streamingToolCalls: [] });
        }
      } else {
        set({
          error: err instanceof Error ? err.message : "Network error",
          isStreaming: false,
          streamingContent: "",
        });
      }
    }

    abortController = null;
  },

  editMessage: async (conversationId, messageId, content) => {
    set({ isStreaming: true, streamingContent: "", streamingToolCalls: [], streamingReasoning: "", error: null });
    abortController = new AbortController();

    const flusher = createStreamFlusher((streamed) => set({ streamingContent: streamed }));
    const reasoningFlusher = createStreamFlusher((reasoning) => set({ streamingReasoning: reasoning }));

    try {
      const result = await consumeStream(
        streamResponse(
          `/api/conversations/${conversationId}/messages/${messageId}/edit`,
          { content },
          abortController.signal,
        ),
        conversationId,
        flusher,
        reasoningFlusher,
        set,
      );
      if (result === "error") return;

      // Reload from server
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const msgs: Message[] = data.messages ?? data;
        const leafId: string | null = data.activeLeafId ?? null;
        const activePath = computeActivePath(msgs, leafId);
        set({ allMessages: msgs, activePath, activeLeafId: leafId, isStreaming: false, streamingContent: "", streamingToolCalls: [] });
        useArtifactsStore.getState().fetchArtifacts(conversationId);
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Edit failed",
        isStreaming: false,
        streamingContent: "",
        streamingToolCalls: [],
      });
    }

    abortController = null;
  },

  regenerateMessage: async (conversationId, messageId) => {
    set({ isStreaming: true, streamingContent: "", streamingToolCalls: [], streamingReasoning: "", error: null });
    abortController = new AbortController();

    const flusher = createStreamFlusher((streamed) => set({ streamingContent: streamed }));
    const reasoningFlusher = createStreamFlusher((reasoning) => set({ streamingReasoning: reasoning }));

    try {
      const result = await consumeStream(
        streamResponse(
          `/api/conversations/${conversationId}/messages/${messageId}/regenerate`,
          {},
          abortController.signal,
        ),
        conversationId,
        flusher,
        reasoningFlusher,
        set,
      );
      if (result === "error") return;

      // Reload from server
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const msgs: Message[] = data.messages ?? data;
        const leafId: string | null = data.activeLeafId ?? null;
        const activePath = computeActivePath(msgs, leafId);
        set({ allMessages: msgs, activePath, activeLeafId: leafId, isStreaming: false, streamingContent: "", streamingToolCalls: [] });
        useArtifactsStore.getState().fetchArtifacts(conversationId);
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Regenerate failed",
        isStreaming: false,
        streamingContent: "",
        streamingToolCalls: [],
      });
    }

    abortController = null;
  },

  switchVariant: (messageId, direction) => {
    const { allMessages } = get();
    const { siblings, index } = getVariantInfo(allMessages, messageId);
    if (siblings.length <= 1) return;

    const newIndex = direction === "next"
      ? (index + 1) % siblings.length
      : (index - 1 + siblings.length) % siblings.length;

    const newMsg = siblings[newIndex];

    // Find the leaf of the new branch
    // Walk forward from this message to find the deepest descendant
    const childrenOf = (parentId: string) =>
      allMessages.filter((m) => m.parentId === parentId);

    let leaf = newMsg;
    let depth = 0;
    while (depth < 1000) {
      const children = childrenOf(leaf.id);
      if (children.length === 0) break;
      // Pick the first child (or the one that's in the current active path)
      leaf = children[0];
      depth++;
    }

    const newLeafId = leaf.id;
    const activePath = computeActivePath(allMessages, newLeafId);
    set({ activeLeafId: newLeafId, activePath });
  },

  stopGeneration: () => {
    abortController?.abort();
  },

  clearChat: () => {
    set({
      allMessages: [],
      activePath: [],
      activeLeafId: null,
      isStreaming: false,
      streamingContent: "",
      streamingToolCalls: [],
      streamingReasoning: "",
      error: null,
    });
  },
}));

export { getVariantInfo, computeActivePath };
export type { Message, Attachment, StreamingToolCall, ToolCallRecord };
