import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/auth";
import { useConversationsStore } from "../stores/conversations";
import { useChatStore } from "../stores/chat";
import { useArtifactsStore } from "../stores/artifacts";
import { useProjectsStore } from "../stores/projects";
import { useUIStore } from "../stores/ui";
import { ThemeToggle } from "./ThemeToggle";
import { ConversationList } from "./ConversationList";
import { ChatView } from "./ChatView";
import { CommandPalette } from "./CommandPalette";

// The artifact panel pulls in heavy renderers (mermaid, diff view, sandbox), so
// it loads on demand only when a panel is actually opened.
const ArtifactPanel = lazy(() =>
  import("./ArtifactPanel").then((m) => ({ default: m.ArtifactPanel })),
);

export function AppShell({ children }: { children?: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const { conversationId } = useParams<{ conversationId: string }>();
  const { setActiveId } = useConversationsStore();
  const { clearChat } = useChatStore();
  const { isPanelOpen } = useArtifactsStore();
  const { projects, fetchProjects } = useProjectsStore();
  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useUIStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setActiveId(conversationId ?? null);
    if (!conversationId) {
      clearChat();
    }
  }, [conversationId, setActiveId, clearChat]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  const isProjectsPage = location.pathname.startsWith("/projects");
  const isMemoryPage = location.pathname.startsWith("/memory");
  const isSettingsPage = location.pathname.startsWith("/settings");
  const isConversationsSection = !isProjectsPage && !isMemoryPage && !isSettingsPage;

  return (
    <div className="flex h-screen bg-stone-50 text-stone-900 dark:bg-[#0e0f13] dark:text-stone-100">
      <CommandPalette />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — static on desktop, off-canvas drawer on mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] transform flex-col border-r border-stone-200/80 bg-stone-100/95 backdrop-blur-sm transition-transform duration-200 dark:border-white/10 dark:bg-[#15171c] md:static md:z-auto md:translate-x-0 md:bg-stone-100/50 md:backdrop-blur-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
            <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.2A7.94 7.94 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="font-serif text-[22px] font-semibold tracking-tight text-stone-900 dark:text-stone-50">
            OpenChat
          </h1>
        </div>

        {/* Navigation */}
        <nav className="space-y-0.5 px-3 pb-1">
          <NavItem
            label="Chats"
            active={isConversationsSection}
            onClick={() => navigate("/")}
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.2A7.94 7.94 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />}
          />
          <NavItem
            label="Projects"
            active={isProjectsPage}
            onClick={() => navigate("/projects")}
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />}
          />
          <NavItem
            label="Memory"
            active={isMemoryPage}
            onClick={() => navigate("/memory")}
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.9 4.5L18.5 9l-3.5 3 1 4.8L12 14.8 8 16.8l1-4.8-3.5-3 4.6-1.5L12 3z" />}
          />

          {/* Quick project links */}
          {projects.length > 0 && isProjectsPage && (
            <div className="mt-1 space-y-0.5 border-l border-stone-200 pl-3 dark:border-white/10">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className={`w-full truncate rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors ${
                    location.pathname === `/projects/${p.id}`
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
                      : "text-stone-500 hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-white/5"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </nav>

        {/* Conversation list (only shown in the conversations section) */}
        <div className="mt-1 flex-1 overflow-hidden">
          {isConversationsSection && <ConversationList />}
        </div>

        {/* Footer — clickable account menu + theme toggle */}
        <div className="border-t border-stone-200/80 p-3 dark:border-white/10">
          <div className="flex items-center gap-1">
            <AccountMenu
              email={user?.email}
              settingsActive={isSettingsPage}
              onSettings={() => navigate("/settings")}
              onLogout={logout}
            />
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main panel */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar with hamburger (hidden on desktop) */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-stone-200/80 px-3 dark:border-white/10 md:hidden">
          <button
            onClick={toggleSidebar}
            className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-white/5"
            aria-label="Open menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-50">OpenChat</span>
        </div>

        <main className="flex min-h-0 flex-1 overflow-hidden">
          <div className={`flex flex-1 flex-col overflow-hidden ${isPanelOpen ? "min-w-0" : ""}`}>
            {children ? (
              children
            ) : conversationId ? (
              <ChatView conversationId={conversationId} />
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-stone-400 dark:text-stone-500">
                  Select or start a conversation.
                </p>
              </div>
            )}
          </div>

          {/* Artifact panel — side panel on desktop, full-screen overlay on mobile */}
          {isPanelOpen && (
            <Suspense fallback={null}>
              <ArtifactPanel />
            </Suspense>
          )}
        </main>
      </div>
    </div>
  );
}

function NavItem({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
        active
          ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
          : "text-stone-600 hover:bg-stone-200/60 dark:text-stone-300 dark:hover:bg-white/5"
      }`}
    >
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
        {icon}
      </svg>
      {label}
    </button>
  );
}

/**
 * Clickable account control: the avatar/email row opens a popover with account
 * actions. Replaces the old non-interactive avatar `<div>` (which is why the
 * "profile button" did nothing). Closes on outside-click or Escape.
 */
function AccountMenu({
  email,
  settingsActive,
  onSettings,
  onLogout,
}: {
  email?: string;
  settingsActive: boolean;
  onSettings: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-20 mb-2 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft dark:border-white/10 dark:bg-[#1a1d23]"
        >
          <div className="border-b border-stone-200/80 px-3 py-2 dark:border-white/10">
            <p className="text-[11px] text-stone-400 dark:text-stone-500">Signed in as</p>
            <p className="truncate text-[13px] font-medium text-stone-800 dark:text-stone-100">
              {email ?? "Account"}
            </p>
          </div>
          <button
            role="menuitem"
            onClick={() => {
              onSettings();
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
              settingsActive
                ? "text-brand-700 dark:text-brand-200"
                : "text-stone-700 dark:text-stone-200"
            } hover:bg-stone-100 dark:hover:bg-white/5`}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.9}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
          <button
            role="menuitem"
            onClick={() => {
              onLogout();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.9}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Log out
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-stone-200/60 dark:hover:bg-white/5"
        title="Account"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold uppercase text-white">
          {email?.[0] ?? "?"}
        </div>
        <span className="min-w-0 flex-1 truncate text-[13px] text-stone-600 dark:text-stone-400">
          {email}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}
