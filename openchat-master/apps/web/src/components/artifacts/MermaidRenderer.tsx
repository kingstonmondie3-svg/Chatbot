import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

interface MermaidRendererProps {
  content: string;
}

// Initialize mermaid once with dark-mode-aware theme
mermaid.initialize({
  startOnLoad: false,
  theme: document.documentElement.classList.contains("dark") ? "dark" : "default",
});

export function MermaidRenderer({ content }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { svg: renderedSvg } = await mermaid.render(id, content.trim());
        if (!cancelled) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
          setSvg(null);
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [content]);

  if (error) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-yellow-200 bg-yellow-50 px-4 py-2 text-xs text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          Mermaid render error — showing source
        </div>
        <pre className="flex-1 overflow-auto px-4 py-3 text-sm">{content}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-stone-400 dark:text-stone-500">Rendering diagram...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full items-center justify-center overflow-auto bg-white p-4 dark:bg-[#0e0f13]"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
