import { useEffect, useState } from "react";
import { useMemoryStore } from "../stores/memory";

export function MemoryPage() {
  const { items, isLoading, fetchItems, updateItem, deleteItem, deleteAll } =
    useMemoryStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleEdit = (id: string, content: string) => {
    setEditingId(id);
    setEditContent(content);
  };

  const handleSave = async (id: string) => {
    if (editContent.trim()) {
      await updateItem(id, editContent.trim());
    }
    setEditingId(null);
    setEditContent("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleDelete = async (id: string) => {
    await deleteItem(id);
  };

  const handleDeleteAll = async () => {
    await deleteAll();
    setConfirmDeleteAll(false);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-200/80 px-6 py-4 dark:border-white/10">
        <div>
          <h2 className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-100">
            Memory
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            OpenChat remembers facts from your conversations to personalize
            responses.
          </p>
        </div>
        {items.length > 0 && (
          <div>
            {confirmDeleteAll ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600 dark:text-red-400">
                  Delete all {items.length} memories?
                </span>
                <button
                  onClick={handleDeleteAll}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDeleteAll(false)}
                  className="rounded-lg px-3 py-1.5 text-sm text-stone-600 transition-colors hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="rounded-lg px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                Clear All
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Loading memories...
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-stone-500 dark:text-stone-400">
              No memories stored yet. OpenChat will remember facts from your
              conversations.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-[#15171c]"
              >
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-stone-100"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(item.id)}
                        className="rounded-lg bg-brand-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="rounded-lg px-3 py-1 text-sm text-stone-600 transition-colors hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-white/5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-stone-900 dark:text-stone-100">
                        {item.content}
                      </p>
                      <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                        {new Date(item.createdAt).toLocaleDateString()}
                        {item.source && ` · ${item.source}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => handleEdit(item.id, item.content)}
                        className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-200/60 hover:text-stone-600 dark:hover:bg-white/5 dark:hover:text-stone-300"
                        title="Edit"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        title="Delete"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
