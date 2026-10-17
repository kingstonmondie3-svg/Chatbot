import { memo, useCallback, useState } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { formatFileSize } from "../lib/format";

function ActionButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-stone-400 transition-colors hover:bg-stone-200/60 hover:text-stone-700 dark:text-stone-500 dark:hover:bg-white/5 dark:hover:text-stone-200"
    >
      {children}
    </button>
  );
}

interface AttachmentInfo {
  id: string;
  filename: string;
  mime: string;
  size: number;
}

interface ArtifactInfo {
  id: string;
  artifactType: string;
  title: string;
  currentVersion: number;
}

function ArtifactTypeIcon({ type }: { type: string }) {
  const cls = "h-3.5 w-3.5";
  switch (type) {
    case "html":
    case "react":
      return (
        <svg className={`${cls} text-orange-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      );
    case "svg":
      return (
        <svg className={`${cls} text-purple-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "mermaid":
      return (
        <svg className={`${cls} text-pink-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case "code":
      return (
        <svg className={`${cls} text-stone-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    default:
      return (
        <svg className={`${cls} text-brand-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
  }
}

interface MessageBubbleProps {
  role: string;
  content: string;
  isStreaming?: boolean;
  onEdit?: (newContent: string) => void;
  onRegenerate?: () => void;
  variantIndex?: number;
  variantCount?: number;
  onVariantPrev?: () => void;
  onVariantNext?: () => void;
  tokenUsage?: { inputTokens: number; outputTokens: number } | null;
  attachments?: AttachmentInfo[];
  artifacts?: ArtifactInfo[];
  onArtifactClick?: (artifactId: string) => void;
  citations?: Record<number, string>;
}

function MessageBubbleInner({
  role,
  content,
  isStreaming,
  onEdit,
  onRegenerate,
  variantIndex = 0,
  variantCount = 1,
  onVariantPrev,
  onVariantNext,
  tokenUsage,
  attachments,
  artifacts,
  onArtifactClick,
  citations,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== content && onEdit) {
      onEdit(editContent.trim());
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  return (
    <div className={`oc-msg-enter group mb-4 flex flex-col ${isUser ? "items-end" : "items-stretch"}`}>
      <div className={isUser ? "max-w-[85%]" : "w-full"}>
        {isEditing ? (
          <div className="rounded-2xl bg-stone-100 px-4 py-3 ring-1 ring-stone-200 dark:bg-white/5 dark:ring-white/10">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full resize-none bg-transparent text-stone-900 outline-none dark:text-stone-100"
              rows={3}
              autoFocus
            />
            <div className="mt-2 flex gap-2 text-xs">
              <button
                onClick={handleSaveEdit}
                className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
              >
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="rounded-lg px-3 py-1.5 text-stone-600 hover:bg-stone-200 dark:text-stone-300 dark:hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : isUser ? (
          <div className="whitespace-pre-wrap rounded-2xl bg-stone-100 px-4 py-2 text-[15px] leading-7 text-stone-900 ring-1 ring-stone-200/70 dark:bg-white/[0.06] dark:text-stone-100 dark:ring-white/10">
            {content}
          </div>
        ) : content.trim() === "" && !isStreaming && (!artifacts || artifacts.length === 0) ? (
          <div className="oc-prose">
            <p className="text-sm italic text-stone-400 dark:text-stone-500">
              No response was generated — the model may have hit its output limit. Try
              again, or raise “Max tokens” in Params for long outputs.
            </p>
          </div>
        ) : (
          <div className="oc-prose">
            <MarkdownRenderer content={content} citations={citations} streaming={isStreaming} />
            {isStreaming && <span className="oc-caret" />}
          </div>
        )}

        {/* Attachment chips */}
        {attachments && attachments.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-0.5 text-xs text-stone-600 ring-1 ring-stone-200/70 dark:bg-white/5 dark:text-stone-300 dark:ring-white/10"
              >
                {att.mime.startsWith("image/") ? (
                  <svg className="h-3 w-3 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="h-3 w-3 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                <span className="max-w-[140px] truncate">{att.filename}</span>
                <span className="text-stone-400">{formatFileSize(att.size)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Artifact cards */}
        {artifacts && artifacts.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {artifacts.map((artifact) => (
              <button
                key={artifact.id}
                onClick={() => onArtifactClick?.(artifact.id)}
                className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-soft transition-colors hover:bg-stone-50 dark:border-white/10 dark:bg-[#1a1d23] dark:hover:bg-white/5"
              >
                <ArtifactTypeIcon type={artifact.artifactType} />
                <span className="truncate text-stone-900 dark:text-stone-100">{artifact.title}</span>
                <span className="ml-auto text-xs text-stone-400">v{artifact.currentVersion}</span>
              </button>
            ))}
          </div>
        )}

        {/* Action bar */}
        {!isStreaming && !isEditing && (
          <div
            className={`mt-1.5 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100 ${
              isUser ? "justify-end" : ""
            }`}
          >
            <ActionButton onClick={handleCopy} label="Copy">
              {copied ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
              {copied ? "Copied" : ""}
            </ActionButton>

            {isUser && onEdit && (
              <ActionButton onClick={() => setIsEditing(true)} label="Edit message">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </ActionButton>
            )}

            {!isUser && onRegenerate && (
              <ActionButton onClick={onRegenerate} label="Regenerate response">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </ActionButton>
            )}

            {variantCount > 1 && (
              <div className="flex items-center gap-1 px-1 text-xs text-stone-400">
                <button
                  onClick={onVariantPrev}
                  className="hover:text-stone-600 dark:hover:text-stone-300"
                  title="Previous variant"
                >
                  &lsaquo;
                </button>
                <span>
                  {variantIndex + 1} / {variantCount}
                </span>
                <button
                  onClick={onVariantNext}
                  className="hover:text-stone-600 dark:hover:text-stone-300"
                  title="Next variant"
                >
                  &rsaquo;
                </button>
              </div>
            )}

            {tokenUsage && (
              <span className="ml-1 text-[11px] text-stone-300 dark:text-stone-600">
                {tokenUsage.outputTokens.toLocaleString()} tok
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Compare only the value props. Callback props (onEdit/onRegenerate/…) are
// recreated on every parent render but close over stable ids, so their identity
// doesn't affect behavior — ignoring them lets finalized messages skip
// re-rendering (and re-parsing markdown) while a new message streams in.
// `attachments`, `artifacts`, and `citations` must be referentially stable from
// the parent (ChatView memoizes them) for this to hold.
function arePropsEqual(prev: MessageBubbleProps, next: MessageBubbleProps): boolean {
  return (
    prev.role === next.role &&
    prev.content === next.content &&
    prev.isStreaming === next.isStreaming &&
    prev.variantIndex === next.variantIndex &&
    prev.variantCount === next.variantCount &&
    prev.tokenUsage === next.tokenUsage &&
    prev.attachments === next.attachments &&
    prev.artifacts === next.artifacts &&
    prev.citations === next.citations
  );
}

export const MessageBubble = memo(MessageBubbleInner, arePropsEqual);
