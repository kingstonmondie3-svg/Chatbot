const EXTENSION_MAP: Record<string, string> = {
  markdown: ".md",
  html: ".html",
  react: ".html",
  svg: ".svg",
  mermaid: ".mermaid",
  code: "", // determined by language
};

// Map a language name to its conventional file extension. Models name the
// language ("typescript", "python"), but the file on disk wants "ts", "py".
const LANGUAGE_EXTENSIONS: Record<string, string> = {
  typescript: "ts",
  javascript: "js",
  python: "py",
  ruby: "rb",
  rust: "rs",
  golang: "go",
  kotlin: "kt",
  csharp: "cs",
  "c++": "cpp",
  cpp: "cpp",
  shell: "sh",
  bash: "sh",
  markdown: "md",
  yaml: "yml",
};

// Code artifacts are often titled with the file's path (e.g. "src/index.ts").
// Keep the basename and its extension intact; only strip characters unsafe in a
// filename. (The old version stripped dots and lowercased, turning
// "package.json" into "packagejson" — so multi-file projects downloaded wrong.)
function sanitizeFilename(title: string): string {
  const basename = title.split(/[\\/]/).pop() ?? title;
  return basename
    .replace(/[^a-zA-Z0-9_.\- ]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 100);
}

export function getArtifactFilename(
  title: string,
  artifactType: string,
  language?: string,
): string {
  const base = sanitizeFilename(title) || "artifact";
  // A path/filename title already carries the right extension — trust it.
  if (/\.[a-zA-Z0-9]{1,8}$/.test(base)) return base;
  if (artifactType === "code") {
    const lang = language?.toLowerCase();
    const ext = (lang && (LANGUAGE_EXTENSIONS[lang] ?? lang)) || "txt";
    return `${base}.${ext}`;
  }
  return `${base}${EXTENSION_MAP[artifactType] ?? ".txt"}`;
}

const DISPLAY_TITLE_REGEX = /title="([^"]*)"/;

function titleOf(attrs: string): string {
  const m = DISPLAY_TITLE_REGEX.exec(attrs);
  return m ? m[1] : "Untitled";
}

/**
 * Replace `<oc-artifact>` blocks in assistant text with a compact
 * `[Artifact: title]` placeholder for display, mirroring what the server stores
 * after parsing. Used on the live stream so the chat shows the placeholder (and
 * a separate "generating…" chip) instead of dumping the artifact's raw file
 * contents into the bubble while it streams, then snapping to a chip on finish.
 *
 * Handles three states a stream can be in: a complete block, an opening tag
 * whose closing tag hasn't arrived yet, and a trailing partial of the opening
 * tag itself (so `<oc-art…` never flashes as raw text between frames).
 */
export function stripArtifactsForDisplay(content: string): string {
  let out = content.replace(
    /<oc-artifact\s+([^>]*)>[\s\S]*?<\/oc-artifact>/g,
    (_m, attrs: string) => `[Artifact: ${titleOf(attrs)}]`,
  );
  // Still-open artifact: collapse from the opening tag to the end of the text.
  out = out.replace(
    /<oc-artifact\s+([^>]*)>[\s\S]*$/,
    (_m, attrs: string) => `[Artifact: ${titleOf(attrs)}]`,
  );
  // Opening tag that hasn't finished arriving (no closing `>` yet) — drop it.
  out = out.replace(/<oc-artifact\b[^>]*$/, "");
  // A trailing partial of the literal "<oc-artifact" marker (e.g. "<oc-a").
  const marker = "<oc-artifact";
  for (let n = Math.min(out.length, marker.length - 1); n > 0; n--) {
    if (out.endsWith(marker.slice(0, n))) {
      out = out.slice(0, out.length - n);
      break;
    }
  }
  return out;
}

export function downloadArtifact(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function copyArtifactContent(content: string): Promise<void> {
  return navigator.clipboard.writeText(content);
}

export async function exportConversation(
  conversationId: string,
  title: string | null,
): Promise<void> {
  const res = await fetch(`/api/conversations/${conversationId}/export/markdown`);
  if (!res.ok) {
    throw new Error(`Export failed: ${res.status}`);
  }
  const markdown = await res.text();
  const sanitizedTitle = (title || "conversation")
    .replace(/[^a-zA-Z0-9_\- ]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 100);
  downloadArtifact(markdown, `${sanitizedTitle}.md`);
}
