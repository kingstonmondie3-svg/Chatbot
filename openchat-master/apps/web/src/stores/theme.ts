import { create } from "zustand";

type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  initTheme: () => Promise<void>;
}

const STORAGE_KEY = "openchat-theme";

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

function applyTheme(resolved: "light" | "dark") {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "system",
  resolvedTheme: "light",

  setTheme: (theme) => {
    const resolved = resolveTheme(theme);
    applyTheme(resolved);
    localStorage.setItem(STORAGE_KEY, theme);
    set({ theme, resolvedTheme: resolved });

    // Persist to server (fire-and-forget)
    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    }).catch(() => {
      // Ignore — localStorage is the fallback
    });
  },

  initTheme: async () => {
    // Apply from localStorage immediately (no flash)
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored) {
      const resolved = resolveTheme(stored);
      applyTheme(resolved);
      set({ theme: stored, resolvedTheme: resolved });
    }

    // Then fetch from server (server wins)
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.theme) {
          const resolved = resolveTheme(data.theme);
          applyTheme(resolved);
          localStorage.setItem(STORAGE_KEY, data.theme);
          set({ theme: data.theme, resolvedTheme: resolved });
        }
      }
    } catch {
      // Offline — localStorage is fine
    }

    // Listen for system theme changes
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (get().theme === "system") {
        const resolved = resolveTheme("system");
        applyTheme(resolved);
        set({ resolvedTheme: resolved });
      }
    });
  },
}));
