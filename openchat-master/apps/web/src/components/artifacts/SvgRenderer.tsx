interface SvgRendererProps {
  content: string;
}

export function SvgRenderer({ content }: SvgRendererProps) {
  return (
    <div className="flex h-full items-center justify-center overflow-auto bg-white p-4 dark:bg-[#0e0f13]">
      <div
        dangerouslySetInnerHTML={{ __html: content }}
        className="max-w-full max-h-full"
      />
    </div>
  );
}
