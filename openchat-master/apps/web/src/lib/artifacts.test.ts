import { describe, it, expect } from "vitest";
import { getArtifactFilename, stripArtifactsForDisplay } from "./artifacts";

describe("getArtifactFilename", () => {
  it("keeps a path/filename title intact, dropping the directory part", () => {
    expect(getArtifactFilename("package.json", "code", "json")).toBe("package.json");
    expect(getArtifactFilename("src/index.ts", "code", "typescript")).toBe("index.ts");
    expect(getArtifactFilename("App.tsx", "code", "tsx")).toBe("App.tsx");
  });

  it("derives an extension from the language when the title has none", () => {
    expect(getArtifactFilename("utils", "code", "python")).toBe("utils.py");
    expect(getArtifactFilename("server", "code", "typescript")).toBe("server.ts");
  });

  it("falls back to the language name for unknown languages", () => {
    expect(getArtifactFilename("query", "code", "sql")).toBe("query.sql");
  });

  it("uses the type extension for non-code artifacts", () => {
    expect(getArtifactFilename("My Page", "html")).toBe("My-Page.html");
    expect(getArtifactFilename("Notes", "markdown")).toBe("Notes.md");
  });

  it("strips unsafe characters and falls back to a default base", () => {
    expect(getArtifactFilename("", "code", "python")).toBe("artifact.py");
    expect(getArtifactFilename("a*b?c", "markdown")).toBe("abc.md");
  });
});

describe("stripArtifactsForDisplay", () => {
  it("leaves ordinary prose untouched", () => {
    expect(stripArtifactsForDisplay("Hello, here is some **text**.")).toBe(
      "Hello, here is some **text**.",
    );
  });

  it("replaces a complete artifact block with a placeholder", () => {
    const input = `Here you go:\n<oc-artifact type="code" title="package.json" language="json">{"name":"x"}</oc-artifact>\nDone.`;
    const out = stripArtifactsForDisplay(input);
    expect(out).toContain("[Artifact: package.json]");
    expect(out).not.toContain("<oc-artifact");
    expect(out).not.toContain('{"name":"x"}');
    expect(out).toContain("Here you go:");
    expect(out).toContain("Done.");
  });

  it("collapses an artifact still being streamed (no closing tag yet)", () => {
    const input = `Building it:\n<oc-artifact type="code" title="src/index.ts" language="typescript">export const a = 1;\nexport const b = 2;`;
    const out = stripArtifactsForDisplay(input);
    expect(out).toContain("[Artifact: src/index.ts]");
    expect(out).not.toContain("export const");
  });

  it("hides an opening tag that has not finished arriving", () => {
    expect(stripArtifactsForDisplay('Text <oc-artifact type="code" tit')).toBe("Text ");
  });

  it("holds back a trailing partial of the opening marker", () => {
    expect(stripArtifactsForDisplay("Almost there <oc-a")).toBe("Almost there ");
    expect(stripArtifactsForDisplay("edge <")).toBe("edge ");
  });

  it("handles multiple artifacts in one message", () => {
    const input = `<oc-artifact type="code" title="a.ts">1</oc-artifact> and <oc-artifact type="code" title="b.ts">2</oc-artifact>`;
    const out = stripArtifactsForDisplay(input);
    expect(out).toBe("[Artifact: a.ts] and [Artifact: b.ts]");
  });
});
