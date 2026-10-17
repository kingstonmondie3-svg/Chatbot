import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useConversationsStore } from "../stores/conversations";

export function ConversationList() {
  const {
    conversations,
    searchResults,
    activeId,
    fetchConversations,
    createConversation,
    deleteConversation,
    updateConversation,
    searchConversations,
    clearSearch,
    setActiveId,
  } = useConversationsStore();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [incognitoNext, setIncognitoNext] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    clearTimeout(debounceRef.current);
    if (value.trim()) {
      debounceRef.current = setTimeout(() => searchConversations(value), 300);
    } else {
      clearSearch();
    }
  };

  const handleNewChat = async () => {
    const id = await createConversation(undefined, undefined, incognitoNext || undefined);
    if (id) {
      setIncognitoNext(false);
      navigate(`/c/${id}`);
    }
  };

  const handleSelect = (id: string) => {
    if (editingId === id) return;
    setActiveId(id);
    navigate(`/c/${id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteConversation(id);
    if (activeId === id) {
      navigate("/");
    }
  };

  const handlePin = async (e: React.MouseEvent, id: string, pinned: boolean) => {
    e.stopPropagation();
    await updateConversation(id, { pinned: !pinned });
  };

  const handleStartRename = (e: React.MouseEvent, id: string, currentTitle: string | null) => {
    e.stopPropagation();
    setEditingId(id);
    setEditTitle(currentTitle ?? "");
  };

  const handleSaveRename = () => {
    if (editingId && editTitle.trim()) {
      updateConversation(editingId, { title: editTitle.trim() });
    }
    setEditingId(null);
    setEditTitle("");
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSaveRename();
    if (e.key === "Escape") handleCancelRename();
  };

  // Use search results when searching, otherwise normal list
  const displayList = searchQuery.trim() ? searchResults : conversations;

  // Sort: pinned first, then by updatedAt desc (only for non-search)
  const sorted = searchQuery.trim()
    ? displayList
    : [...displayList].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

  // Virtualize the list so long histories stay smooth (spec K + A2).
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 8,
    getItemKey: (index) => sorted[index].id,
  });

  return (
    <div ref={parentRef} className="flex h-full flex-col overflow-y-auto">
      {/* New chat (primary) */}
      <div className="sticky top-0 z-10 px-3 pb-2 pt-1">
        <button
          onClick={handleNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
          New chat
        </button>
        <button
          type="button"
          onClick={() => setIncognitoNext((v) => !v)}
          aria-pressed={incognitoNext}
          title="Incognito: this conversation will not contribute to memory"
          className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
            incognitoNext
              ? "bg-brand-50 text-brand-700 ring-1 ring-brand-500/30 dark:bg-brand-500/15 dark:text-brand-200"
              : "text-stone-400 hover:bg-stone-200/50 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-white/5"
          }`}
        >
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
          </svg>
          Incognito{incognitoNext ? " · on" : " (skip memory)"}
        </button>
      </div>

      {/* Search input */}
      <div className="relative px-3 pb-2">
        <svg className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search chats"
          className="w-full rounded-xl border border-stone-200 bg-white/70 py-2 pl-8 pr-3 text-sm text-stone-700 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-stone-200 dark:placeholder:text-stone-500"
        />
      </div>

      <div className="flex-1 px-2 pb-2">
        {sorted.length === 0 ? (
          <p className="px-3 py-4 text-sm text-stone-400 dark:text-stone-500">
            {searchQuery.trim() ? "No results found." : "No conversations yet."}
          </p>
        ) : (
          <div
            className="relative w-full"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const conv = sorted[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(conv.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelect(conv.id);
                    }
                  }}
                  aria-current={activeId === conv.id ? "page" : undefined}
                  className={`group absolute left-0 top-0 flex w-full min-w-0 cursor-pointer items-center gap-1 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    activeId === conv.id
                      ? "bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100"
                      : "text-stone-600 hover:bg-stone-200/60 dark:text-stone-300 dark:hover:bg-white/5"
                  }`}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                      {conv.pinned && (
                        <svg className="mr-1.5 h-3.5 w-3.5 shrink-0 text-brand-500" viewBox="0 0 24 24" fill="currentColor" aria-label="Pinned">
                          <path d="M9.5 2a1 1 0 00-1 1v5.6L5.7 12a1 1 0 00-.2.6V14a1 1 0 001 1h4v6a1 1 0 002 0v-6h4a1 1 0 001-1v-1.4a1 1 0 00-.2-.6L15.5 8.6V3a1 1 0 00-1-1h-5z" />
                        </svg>
                      )}
                      {editingId === conv.id ? (
                        <input
                          ref={editInputRef}
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={handleRenameKeyDown}
                          onBlur={handleSaveRename}
                          className="min-w-0 flex-1 rounded-md border border-brand-400 bg-white px-1.5 py-1 text-sm outline-none dark:bg-stone-800"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="flex-1 truncate">
                          {conv.title ?? "New conversation"}
                        </span>
                      )}

                    {editingId !== conv.id && (
                      <div className="ml-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => handlePin(e, conv.id, conv.pinned)}
                          className="rounded-md p-1 text-stone-400 hover:bg-black/5 hover:text-brand-500 dark:hover:bg-white/10"
                          title={conv.pinned ? "Unpin" : "Pin"}
                          aria-label={conv.pinned ? "Unpin conversation" : "Pin conversation"}
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill={conv.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 3h5v5.6l2.8 3.4v1.4h-4v6h-2v-6h-4V12L9.5 8.6V3z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleStartRename(e, conv.id, conv.title)}
                          className="rounded-md p-1 text-stone-400 hover:bg-black/5 hover:text-brand-500 dark:hover:bg-white/10"
                          title="Rename"
                          aria-label="Rename conversation"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, conv.id)}
                          className="rounded-md p-1 text-stone-400 hover:bg-black/5 hover:text-red-500 dark:hover:bg-white/10"
                          title="Delete"
                          aria-label="Delete conversation"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V7" />
                          </svg>
                        </button>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
