import { create } from "zustand";

interface MemoryItem {
  id: string;
  userId: string;
  conversationId: string | null;
  content: string;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MemoryState {
  items: MemoryItem[];
  isLoading: boolean;

  fetchItems: () => Promise<void>;
  updateItem: (id: string, content: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  deleteAll: (conversationId?: string) => Promise<void>;
}

export const useMemoryStore = create<MemoryState>((set, _get) => ({
  items: [],
  isLoading: false,

  fetchItems: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/memory");
      if (res.ok) {
        const data = await res.json();
        set({ items: data, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  updateItem: async (id, content) => {
    try {
      const res = await fetch(`/api/memory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const updated = await res.json();
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updated } : item,
          ),
        }));
      }
    } catch {
      // ignore
    }
  },

  deleteItem: async (id) => {
    try {
      const res = await fetch(`/api/memory/${id}`, { method: "DELETE" });
      if (res.ok) {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      }
    } catch {
      // ignore
    }
  },

  deleteAll: async (conversationId) => {
    try {
      const url = conversationId
        ? `/api/memory?conversationId=${conversationId}`
        : "/api/memory";
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        if (conversationId) {
          set((state) => ({
            items: state.items.filter((item) => item.conversationId !== conversationId),
          }));
        } else {
          set({ items: [] });
        }
      }
    } catch {
      // ignore
    }
  },
}));

export type { MemoryItem };
