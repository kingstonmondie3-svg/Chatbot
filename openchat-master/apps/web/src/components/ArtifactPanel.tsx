import { useState, useCallback } from "react";
import { useArtifactsStore } from "../stores/artifacts";
import { ArtifactRenderer } from "./artifacts/ArtifactRenderer";
import { DiffView } from "./artifacts/DiffView";
import {
  getArtifactFilename,
  downloadArtifact,
  copyArtifactContent,
} from "../lib/artifacts";

const TYPE_LABELS: Record<string, string> = {
  markdown: "Markdown",
  html: "HTML",
  react: "React",
  svg: "SVG",
  mermaid: "Mermaid",
  code: "Code",
};

const TYPE_COLORS: Record<string, string> = {
  markdown: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200",
  html: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  react: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  svg: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  mermaid: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  code: "bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-stone-300",
};

export function ArtifactPanel() {
  const {
    activeArtifact,
    activeVersionNumber,
    isDiffView,
    setActiveVersion,
    toggleDiffView,
    closePanel,
    saveArtifactVersion,
  } = useArtifactsStore();

  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  const currentVersion = activeArtifact?.versions.find(
    (v) => v.versionNumber === activeVersionNumber,
  );

  const handleCopy = useCallback(async () => {
    if (!currentVersion) return;
    await copyArtifactContent(currentVersion.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentVersion]);

  const handleDownload = useCallback(() => {
    if (!currentVersion || !activeArtifact) return;
    const filename = getArtifactFilename(
      activeArtifact.title,
      activeArtifact.artifactType,
      activeArtifact.language,
    );
    downloadArtifact(currentVersion.content, filename);
  }, [currentVersion, activeArtifact]);

  const handleEdit = useCallback(() => {
    if (!currentVersion) return;
    setEditContent(currentVersion.content);
    setIsEditing(true);
  }, [currentVersion]);

  const handleSaveEdit = useCallback(async () => {
    if (!activeArtifact) return;
    await saveArtifactVersion(
      activeArtifact.conversationId,
      activeArtifact.id,
      editContent,
    );
    setIsEditing(false);
  }, [activeArtifact, editContent, saveArtifactVersion]);

  if (!activeArtifact) return null;

  const totalVersions = activeArtifact.versions.length;

  return (
    <div className="fixed inset-0 z-30 flex h-full w-full flex-col border-l border-stone-200/80 bg-white dark:border-white/10 dark:bg-[#15171c] md:static md:z-auto md:w-[480px]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-stone-200/80 px-4 py-2 dark:border-white/10">
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            TYPE_COLORS[activeArtifact.artifactType] ?? TYPE_COLORS.code
          }`}
        >
          {TYPE_LABELS[activeArtifact.artifactType] ?? activeArtifact.artifactType}
        </span>
        <span className="flex-1 truncate text-sm font-medium text-stone-900 dark:text-stone-100">
          {activeArtifact.title}
        </span>
        <button
          onClick={closePanel}
          className="rounded-lg p-1 text-stone-400 transition-colors hover:bg-stone-200/60 hover:text-stone-600 dark:hover:bg-white/5 dark:hover:text-stone-300"
          title="Close panel"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Version nav + toolbar */}
      <div className="flex items-center justify-between border-b border-stone-200/80 px-4 py-1.5 dark:border-white/10">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveVersion(activeVersionNumber - 1)}
            disabled={activeVersionNumber <= 1}
            className="rounded-lg p-1 text-stone-400 transition-colors hover:bg-stone-200/60 hover:text-stone-600 disabled:opacity-30 dark:hover:bg-white/5"
            title="Previous version"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="min-w-[80px] text-center text-xs text-stone-500 dark:text-stone-400">
            Version {activeVersionNumber} of {totalVersions}
          </span>
          <button
            onClick={() => setActiveVersion(activeVersionNumber + 1)}
            disabled={activeVersionNumber >= totalVersions}
            className="rounded-lg p-1 text-stone-400 transition-colors hover:bg-stone-200/60 hover:text-stone-600 disabled:opacity-30 dark:hover:bg-white/5"
            title="Next version"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {totalVersions > 1 && (
            <button
              onClick={toggleDiffView}
              className={`rounded-lg px-2 py-1 text-xs transition-colors ${
                isDiffView
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
                  : "text-stone-500 hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-white/5"
              }`}
              title="Toggle diff view"
            >
              Diff
            </button>
          )}
          <button
            onClick={handleEdit}
            className="rounded-lg px-2 py-1 text-xs text-stone-500 transition-colors hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-white/5"
            title="Edit content"
          >
            Edit
          </button>
          <button
            onClick={handleCopy}
            className="rounded-lg px-2 py-1 text-xs text-stone-500 transition-colors hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-white/5"
            title="Copy content"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={handleDownload}
            className="rounded-lg px-2 py-1 text-xs text-stone-500 transition-colors hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-white/5"
            title="Download"
          >
            Download
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {isEditing ? (
          <div className="flex h-full flex-col">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 resize-none border-0 bg-stone-50 p-4 font-mono text-sm outline-none dark:bg-[#0e0f13]"
              spellCheck={false}
            />
            <div className="flex items-center gap-2 border-t border-stone-200/80 px-4 py-2 dark:border-white/10">
              <button
                onClick={handleSaveEdit}
                className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-700"
              >
                Save as new version
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="rounded-lg px-3 py-1 text-xs text-stone-500 transition-colors hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : isDiffView && activeVersionNumber > 1 ? (
          <DiffView
            oldContent={
              activeArtifact.versions.find(
                (v) => v.versionNumber === activeVersionNumber - 1,
              )?.content ?? ""
            }
            newContent={currentVersion?.content ?? ""}
          />
        ) : currentVersion ? (
          <ArtifactRenderer
            artifactType={activeArtifact.artifactType}
            content={currentVersion.content}
            language={activeArtifact.language}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-stone-400 dark:text-stone-500">No version content available.</p>
          </div>
        )}
      </div>
    </div>
  );
}
