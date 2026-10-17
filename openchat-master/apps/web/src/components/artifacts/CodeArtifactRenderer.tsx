import { useState, useCallback, useEffect, useRef } from "react";
import hljs from "highlight.js";

interface CodeArtifactRendererProps {
  content: string;
  language?: string;
}

export function CodeArtifactRenderer({ content, language }: CodeArtifactRendererProps) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.textContent = content;
      if (language && hljs.getLanguage(language)) {
        codeRef.current.innerHTML = hljs.highlight(content, { language }).value;
      } else {
        codeRef.current.innerHTML = hljs.highlightAuto(content).value;
      }
    }
  }, [content, language]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const lines = content.split("\n");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-stone-200/80 bg-stone-100 px-4 py-1.5 dark:border-white/10 dark:bg-[#15171c]">
        <span className="text-xs text-stone-500 dark:text-stone-400">
          {language ?? "auto"}
          <span className="ml-2 text-stone-400 dark:text-stone-500">
            {lines.length} lines
          </span>
        </span>
        <button
          onClick={handleCopy}
          className="text-xs text-stone-500 transition-colors hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="flex">
          {/* Line numbers */}
          <div className="flex-shrink-0 select-none border-r border-stone-200/80 bg-stone-50 pr-3 text-right dark:border-white/10 dark:bg-white/[0.03]">
            {lines.map((_, i) => (
              <div key={i} className="px-2 text-xs leading-6 text-stone-400 dark:text-stone-500">
                {i + 1}
              </div>
            ))}
          </div>
          {/* Code */}
          <pre className="flex-1 overflow-x-auto px-4 py-2 text-sm leading-6">
            <code ref={codeRef} className={language ? `language-${language}` : ""} />
          </pre>
        </div>
      </div>
    </div>
  );
}
