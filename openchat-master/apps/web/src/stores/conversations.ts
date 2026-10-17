import { create } from "zustand";
import type { ModelInfo } from "@openchat/shared";

interface ConversationParams {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

interface Conversation {
  id: string;
  title: string | null;
  model: string;
  params?: ConversationParams;
  pinned: boolean;
  incognito: boolean;
  activeLeafId?: string | null;
  projectId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConversationsState {
  conversations: Conversation[];
  searchResults: Conversation[];
  models: ModelInfo[];
  isLoading: boolean;
  activeId: string | null;

  fetchConversations: () => Promise<void>;
  createConversation: (model?: string, projectId?: string, incognito?: boolean) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversation: (id: string, updates: Partial<Conversation>) => Promise<void>;
  searchConversations: (query: string) => Promise<void>;
  clearSearch: () => void;
  fetchModels: () => Promise<void>;
  setActiveId: (id: string | null) => void;
}

export const useConversationsStore = create<ConversationsState>((set, _get) => ({
  conversations: [],
  searchResults: [],
  models: [],
  isLoading: false,
  activeId: null,

  fetchConversations: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        set({ conversations: data, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  createConversation: async (model, projectId, incognito) => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, projectId, incognito }),
      });
      if (res.ok) {
        const conv = await res.json();
        set((state) => ({
          conversations: [conv, ...state.conversations],
          activeId: conv.id,
        }));
        return conv.id;
      }
    } catch {
      // ignore
    }
    return "";
  },

  deleteConversation: async (id) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (res.ok) {
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          activeId: state.activeId === id ? null : state.activeId,
        }));
      }
    } catch {
      // ignore
    }
  },

  updateConversation: async (id, updates) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, ...updated } : c,
          ),
        }));
      }
    } catch {
      // ignore
    }
  },

  searchConversations: async (query) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    try {
      const res = await fetch(`/api/conversations/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        set({ searchResults: data });
      }
    } catch {
      // ignore
    }
  },

  clearSearch: () => set({ searchResults: [] }),

  fetchModels: async () => {
    try {
      const res = await fetch("/api/models");
      if (res.ok) {
        const data = await res.json();
        set({ models: data });
      }
    } catch {
      // ignore
    }
  },

  setActiveId: (id) => set({ activeId: id }),
}));

export type { Conversation, ConversationParams };
