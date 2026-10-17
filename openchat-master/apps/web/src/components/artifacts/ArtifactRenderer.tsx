import { lazy, Suspense } from "react";
import { MarkdownArtifactRenderer } from "./MarkdownArtifactRenderer";
import { CodeArtifactRenderer } from "./CodeArtifactRenderer";
import { SvgRenderer } from "./SvgRenderer";

// mermaid is large and the sandbox iframe is only needed for HTML/React
// artifacts — load each on demand so opening (say) a code artifact never pulls
// mermaid into memory.
const MermaidRenderer = lazy(() =>
  import("./MermaidRenderer").then((m) => ({ default: m.MermaidRenderer })),
);
const SandboxIframe = lazy(() =>
  import("./SandboxIframe").then((m) => ({ default: m.SandboxIframe })),
);

interface ArtifactRendererProps {
  artifactType: string;
  content: string;
  language?: string;
}

export function ArtifactRenderer({ artifactType, content, language }: ArtifactRendererProps) {
  switch (artifactType) {
    case "markdown":
      return <MarkdownArtifactRenderer content={content} />;
    case "code":
      return <CodeArtifactRenderer content={content} language={language} />;
    case "svg":
      return <SvgRenderer content={content} />;
    case "mermaid":
      return (
        <Suspense fallback={<RendererFallback />}>
          <MermaidRenderer content={content} />
        </Suspense>
      );
    case "html":
    case "react":
      return (
        <Suspense fallback={<RendererFallback />}>
          <SandboxIframe content={content} artifactType={artifactType as "html" | "react"} />
        </Suspense>
      );
    default:
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-stone-400 dark:text-stone-500">Unknown artifact type: {artifactType}</p>
        </div>
      );
  }
}

function RendererFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-stone-400 dark:text-stone-500">Loading preview…</p>
    </div>
  );
}
