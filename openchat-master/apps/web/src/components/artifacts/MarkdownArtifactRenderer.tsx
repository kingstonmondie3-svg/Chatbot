import { MarkdownRenderer } from "../MarkdownRenderer";

interface MarkdownArtifactRendererProps {
  content: string;
}

export function MarkdownArtifactRenderer({ content }: MarkdownArtifactRendererProps) {
  return (
    <div className="h-full overflow-y-auto px-6 py-4">
      <MarkdownRenderer content={content} />
    </div>
  );
}
