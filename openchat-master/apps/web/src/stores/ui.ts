import { create } from "zustand";

interface UIState {
  /** Mobile off-canvas sidebar visibility (ignored at >= md where the sidebar is static). */
  sidebarOpen: boolean;
  /** Command palette (Cmd/Ctrl+K) visibility. */
  commandPaletteOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  commandPaletteOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
}));
