import { create } from "zustand";

interface ArtifactMeta {
  id: string;
  messageId: string;
  conversationId: string;
  artifactType: string;
  title: string;
  language?: string;
  currentVersion: number;
  createdAt: string;
}

interface ArtifactVersion {
  id: string;
  artifactId: string;
  versionNumber: number;
  content: string;
  createdAt: string;
}

interface ArtifactWithVersions extends ArtifactMeta {
  versions: ArtifactVersion[];
}

interface ArtifactsState {
  artifactsByConversation: Map<string, ArtifactMeta[]>;
  activeArtifact: ArtifactWithVersions | null;
  isPanelOpen: boolean;
  activeVersionNumber: number;
  isDiffView: boolean;

  fetchArtifacts: (conversationId: string) => Promise<void>;
  openArtifact: (conversationId: string, artifactId: string) => Promise<void>;
  closePanel: () => void;
  setActiveVersion: (versionNumber: number) => void;
  toggleDiffView: () => void;
  addStreamingArtifact: (conversationId: string, artifact: ArtifactMeta) => void;
  saveArtifactVersion: (conversationId: string, artifactId: string, content: string) => Promise<void>;
}

export const useArtifactsStore = create<ArtifactsState>((set, get) => ({
  artifactsByConversation: new Map(),
  activeArtifact: null,
  isPanelOpen: false,
  activeVersionNumber: 1,
  isDiffView: false,

  fetchArtifacts: async (conversationId) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/artifacts`);
      if (res.ok) {
        const rows: ArtifactMeta[] = await res.json();
        set((state) => {
          const next = new Map(state.artifactsByConversation);
          next.set(conversationId, rows);
          return { artifactsByConversation: next };
        });
      }
    } catch {
      // Silently fail — artifacts are non-critical
    }
  },

  openArtifact: async (conversationId, artifactId) => {
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/artifacts/${artifactId}`,
      );
      if (res.ok) {
        const data: ArtifactWithVersions = await res.json();
        set({
          activeArtifact: data,
          isPanelOpen: true,
          activeVersionNumber: data.currentVersion,
          isDiffView: false,
        });
      }
    } catch {
      // Silently fail
    }
  },

  closePanel: () => {
    set({
      activeArtifact: null,
      isPanelOpen: false,
      activeVersionNumber: 1,
      isDiffView: false,
    });
  },

  setActiveVersion: (versionNumber) => {
    set({ activeVersionNumber: versionNumber, isDiffView: false });
  },

  toggleDiffView: () => {
    set((state) => ({ isDiffView: !state.isDiffView }));
  },

  addStreamingArtifact: (conversationId, artifact) => {
    set((state) => {
      const next = new Map(state.artifactsByConversation);
      const existing = next.get(conversationId) ?? [];
      // Avoid duplicates
      if (existing.some((a) => a.id === artifact.id)) return state;
      next.set(conversationId, [...existing, artifact]);
      return { artifactsByConversation: next };
    });
  },

  saveArtifactVersion: async (conversationId, artifactId, content) => {
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/artifacts/${artifactId}/versions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
      if (res.ok) {
        const version: ArtifactVersion = await res.json();
        // Refresh the artifact with new version
        const { activeArtifact } = get();
        if (activeArtifact && activeArtifact.id === artifactId) {
          set({
            activeArtifact: {
              ...activeArtifact,
              currentVersion: version.versionNumber,
              versions: [...activeArtifact.versions, version],
            },
            activeVersionNumber: version.versionNumber,
          });
        }
        // Also refresh the artifact list
        await get().fetchArtifacts(conversationId);
      }
    } catch {
      // Silently fail
    }
  },
}));

export type { ArtifactMeta, ArtifactVersion, ArtifactWithVersions };
