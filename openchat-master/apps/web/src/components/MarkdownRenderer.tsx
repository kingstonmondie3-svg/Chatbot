import { memo, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";

interface MarkdownRendererProps {
  content: string;
  citations?: Record<number, string>;
  /** While true, skip the costly highlight/KaTeX passes (see note on the component). */
  streaming?: boolean;
}

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const language = className?.replace("language-", "") ?? "";

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  return (
    <div className="relative group">
      {language && (
        <div className="flex items-center justify-between rounded-t-xl bg-[#161b22] px-4 py-1.5 text-xs text-stone-400">
          <span>{language}</span>
          <button
            onClick={handleCopy}
            className="transition-colors hover:text-white"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
      <pre className={className}>
        <code>{children}</code>
      </pre>
      {!language && (
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 hidden rounded-md bg-white/10 px-2 py-1 text-xs text-stone-300 transition-colors hover:bg-white/20 group-hover:block"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      )}
    </div>
  );
}

const CITATION_REGEX = /\[(\d+)\](?!\()/g;

function renderTextWithCitations(
  text: string,
  citations?: Record<number, string>,
): React.ReactNode[] {
  if (!citations) return [text];

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  CITATION_REGEX.lastIndex = 0;
  while ((match = CITATION_REGEX.exec(text)) !== null) {
    // Add text before the citation
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const num = parseInt(match[1], 10);
    const url = citations[num];
    if (url) {
      parts.push(
        <sup key={`cit-${match.index}`}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            [{num}]
          </a>
        </sup>,
      );
    } else {
      parts.push(match[0]);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

// Memoized: react-markdown + rehype-highlight + rehype-katex is expensive, and
// during streaming the parent re-renders the whole thread. Skipping re-parse for
// messages whose content/citations are unchanged keeps long threads smooth.
//
// While a message is still streaming its `content` grows every frame, so the
// memo can't help — and re-running highlight.js + KaTeX over the whole message
// each frame is O(n²) and the main cause of mid-stream freezing. So we drop
// those passes while streaming; the moment the message finalizes this component
// re-mounts with the stored content and highlights once.
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  citations,
  streaming,
}: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={streaming ? [] : [remarkMath]}
      rehypePlugins={streaming ? [] : [rehypeKatex, rehypeHighlight]}
      components={{
        code({ children, className, ...props }) {
          const isBlock = Boolean(className);
          if (isBlock) {
            return (
              <CodeBlock className={className}>
                {String(children).replace(/\n$/, "")}
              </CodeBlock>
            );
          }
          return (
            <code className="rounded bg-stone-100 px-1 py-0.5 text-[0.9em] text-stone-800 dark:bg-white/10 dark:text-stone-100" {...props}>
              {children}
            </code>
          );
        },
        p({ children, ...props }) {
          if (typeof children === "string" && citations) {
            return <p {...props}>{renderTextWithCitations(children, citations)}</p>;
          }
          return <p {...props}>{children}</p>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
});
