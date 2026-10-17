import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUIStore } from "../stores/ui";
import { useConversationsStore } from "../stores/conversations";
import { useThemeStore } from "../stores/theme";

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
}

/**
 * Cmd/Ctrl+K command palette: fuzzy-jump between conversations and run common
 * actions (new chat, navigate, toggle theme). Also owns the global keyboard
 * shortcuts (Cmd+K to open, Cmd+Shift+O for a new chat).
 */
export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setSidebarOpen } = useUIStore();
  const navigate = useNavigate();
  const { conversations, createConversation, fetchConversations } = useConversationsStore();
  const { theme, setTheme } = useThemeStore();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setCommandPaletteOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, [setCommandPaletteOpen]);

  const newChat = useCallback(async () => {
    close();
    const id = await createConversation();
    if (id) navigate(`/c/${id}`);
  }, [close, createConversation, navigate]);

  // Global shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useUIStore.getState().setCommandPaletteOpen(!useUIStore.getState().commandPaletteOpen);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        void newChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChat]);

  // Refresh data + focus input when opened.
  useEffect(() => {
    if (commandPaletteOpen) {
      fetchConversations();
      setActiveIndex(0);
      // focus after paint
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [commandPaletteOpen, fetchConversations]);

  const commands = useMemo<Command[]>(() => {
    const actions: Command[] = [
      { id: "new-chat", label: "New chat", hint: "⌘⇧O", group: "Actions", run: () => void newChat() },
      { id: "go-projects", label: "Go to Projects", group: "Navigate", run: () => { close(); navigate("/projects"); } },
      { id: "go-memory", label: "Go to Memory", group: "Navigate", run: () => { close(); navigate("/memory"); } },
      { id: "go-settings", label: "Go to Settings", group: "Navigate", run: () => { close(); navigate("/settings"); } },
      {
        id: "toggle-theme",
        label: `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
        group: "Actions",
        run: () => { setTheme(theme === "dark" ? "light" : "dark"); close(); },
      },
    ];
    const convs: Command[] = conversations.slice(0, 50).map((c) => ({
      id: `conv-${c.id}`,
      label: c.title ?? "New conversation",
      group: "Conversations",
      run: () => { close(); navigate(`/c/${c.id}`); },
    }));
    return [...actions, ...convs];
  }, [conversations, theme, newChat, close, navigate, setTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  // Keep active index in range as the filtered set shrinks.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  if (!commandPaletteOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[activeIndex]?.run();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-soft dark:border-white/10 dark:bg-[#15171c]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); setSidebarOpen(false); }}
          onKeyDown={handleKeyDown}
          placeholder="Search conversations or run a command…"
          className="w-full border-b border-stone-200/80 bg-transparent px-4 py-3 text-[15px] text-stone-900 placeholder-stone-400 focus:outline-none dark:border-white/10 dark:text-stone-100 dark:placeholder-stone-500"
        />
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-stone-400 dark:text-stone-500">No matches</p>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={cmd.run}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors ${
                  i === activeIndex
                    ? "bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100"
                    : "text-stone-700 dark:text-stone-300"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-stone-400 dark:text-stone-500">
                    {cmd.group}
                  </span>
                  <span className="truncate">{cmd.label}</span>
                </span>
                {cmd.hint && <kbd className="shrink-0 text-xs text-stone-400">{cmd.hint}</kbd>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
