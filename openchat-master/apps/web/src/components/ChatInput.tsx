import { type FormEvent, type KeyboardEvent, useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { uploadFiles } from "../lib/uploads";
import { formatFileSize } from "../lib/format";

interface ChatInputProps {
  onSend: (content: string, attachmentIds?: string[]) => void;
  isStreaming: boolean;
  onStop: () => void;
}

const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function ChatInput({ onSend, isStreaming, onStop }: ChatInputProps) {
  const [content, setContent] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setUploadError(null);
      setPendingFiles((prev) => {
        const combined = [...prev, ...acceptedFiles].slice(0, MAX_FILES);
        return combined;
      });
    },
    [],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_SIZE,
    maxFiles: MAX_FILES,
    noClick: true,
    noKeyboard: true,
    onDropRejected: (rejections) => {
      const msg = rejections[0]?.errors?.[0]?.message ?? "File rejected";
      setUploadError(msg);
    },
  });

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length > 0) {
      e.preventDefault();
      onDrop(files);
    }
  };

  const doSend = async () => {
    if (!content.trim() || isStreaming) return;
    setUploadError(null);

    let attachmentIds: string[] | undefined;
    if (pendingFiles.length > 0) {
      setUploading(true);
      try {
        const results = await uploadFiles(pendingFiles);
        attachmentIds = results.map((r) => r.id);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onSend(content.trim(), attachmentIds);
    setContent("");
    setPendingFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    doSend();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  return (
    <div
      {...getRootProps()}
      className={`border-t border-stone-200/80 bg-stone-50/80 backdrop-blur-sm dark:border-white/10 dark:bg-[#0e0f13]/80 ${
        isDragActive ? "ring-2 ring-brand-500" : ""
      }`}
    >
      <input {...getInputProps()} />
      <div className="mx-auto max-w-3xl px-4 py-3">

      {/* Pending files strip */}
      {pendingFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingFiles.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-1.5 rounded-lg bg-stone-100 px-2 py-1 text-xs text-stone-700 ring-1 ring-stone-200/70 dark:bg-white/5 dark:text-stone-300 dark:ring-white/10"
            >
              {file.type.startsWith("image/") ? (
                <svg className="h-3.5 w-3.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              <span className="max-w-[120px] truncate">{file.name}</span>
              <span className="text-stone-400">{formatFileSize(file.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="ml-0.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="mb-2 text-xs text-red-500">{uploadError}</div>
      )}

      {/* Drag overlay */}
      {isDragActive && (
        <div className="mb-2 rounded-xl border-2 border-dashed border-brand-400 bg-brand-50 p-4 text-center text-sm text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          Drop files here
        </div>
      )}

      {/* Composer — one elevated rounded container */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-1.5 rounded-2xl border border-stone-200 bg-white py-1.5 pl-1.5 pr-1.5 shadow-composer transition focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 dark:border-white/10 dark:bg-[#1a1d23]"
      >
        {/* Paperclip button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || isStreaming}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:opacity-50 dark:hover:bg-white/5 dark:hover:text-stone-200"
          title="Attach files"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) onDrop(files);
            e.target.value = "";
          }}
          accept="image/*,.pdf,.txt,.md,.csv,.docx,.py,.js,.ts,.html,.css,.json"
        />

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onPaste={handlePaste}
          placeholder={
            pendingFiles.length > 0
              ? "Add a message about your files..."
              : "Message OpenChat…"
          }
          rows={1}
          className="flex-1 resize-none self-center border-0 bg-transparent px-1 py-2 text-[15px] text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-0 dark:text-stone-100 dark:placeholder-stone-500"
          style={{ maxHeight: "200px" }}
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-800 text-white transition-colors hover:bg-stone-700 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-white"
            title="Stop generating"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="3" width="10" height="10" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!content.trim() || uploading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 dark:disabled:bg-white/10 dark:disabled:text-stone-500"
            title="Send message"
          >
            {uploading ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            )}
          </button>
        )}
      </form>

      <p className="mt-1.5 text-center text-[11px] text-stone-400 dark:text-stone-600">
        Enter to send, Shift+Enter for a new line
      </p>
      </div>
    </div>
  );
}
