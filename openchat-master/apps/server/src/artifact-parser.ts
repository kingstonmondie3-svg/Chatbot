import type { ArtifactType } from "@openchat/shared";

export interface ParsedArtifact {
  artifactType: ArtifactType;
  title: string;
  language?: string;
  content: string;
}

const ARTIFACT_REGEX =
  /<oc-artifact\s+([^>]*)>([\s\S]*?)<\/oc-artifact>/g;

const ATTR_REGEX = /(\w+)="([^"]*)"/g;

function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let match;
  while ((match = ATTR_REGEX.exec(attrString)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

const VALID_TYPES: ArtifactType[] = [
  "markdown",
  "html",
  "react",
  "svg",
  "mermaid",
  "code",
];

/** Extract artifacts from model output, returning clean content + parsed artifacts. */
export function parseArtifacts(content: string): {
  cleanContent: string;
  artifacts: ParsedArtifact[];
} {
  const artifacts: ParsedArtifact[] = [];
  let cleanContent = content;
  let match;

  // Reset regex state
  ARTIFACT_REGEX.lastIndex = 0;

  while ((match = ARTIFACT_REGEX.exec(content)) !== null) {
    const attrs = parseAttributes(match[1]);
    const type = attrs.type as ArtifactType;
    const title = attrs.title ?? "Untitled";
    const language = attrs.language;

    if (!VALID_TYPES.includes(type)) continue;

    artifacts.push({
      artifactType: type,
      title,
      language,
      content: match[2].trim(),
    });

    // Replace the artifact block with a placeholder in clean content
    cleanContent = cleanContent.replace(
      match[0],
      `[Artifact: ${title}]`,
    );
  }

  // Recover a trailing artifact whose closing tag never arrived — e.g. the model
  // hit its token limit mid-artifact. Without this, the raw <oc-artifact …> tag
  // is stored and renders as a blank/garbled message ("no result shown").
  const openMatch = /<oc-artifact\s+([^>]*)>([\s\S]*)$/.exec(cleanContent);
  if (openMatch) {
    const attrs = parseAttributes(openMatch[1]);
    const type = attrs.type as ArtifactType;
    if (VALID_TYPES.includes(type)) {
      const title = attrs.title ?? "Untitled";
      artifacts.push({
        artifactType: type,
        title,
        language: attrs.language,
        content: openMatch[2].trim(),
      });
      cleanContent = `${cleanContent.slice(0, openMatch.index)} [Artifact: ${title}]`;
    }
  }

  // Drop any stray/partial artifact tag fragments so raw markup never leaks.
  cleanContent = cleanContent.replace(/<\/?oc-artifact[^>]*>?/g, "").trim();

  return { cleanContent, artifacts };
}

/** Strip artifact blocks for model context — replaces with text summaries. */
export function stripArtifactsForModelContext(content: string): string {
  let result = content;
  let match;

  ARTIFACT_REGEX.lastIndex = 0;

  while ((match = ARTIFACT_REGEX.exec(content)) !== null) {
    const attrs = parseAttributes(match[1]);
    const type = attrs.type ?? "unknown";
    const title = attrs.title ?? "Untitled";

    result = result.replace(
      match[0],
      `[Generated ${type} artifact: "${title}"]`,
    );
  }

  return result;
}
