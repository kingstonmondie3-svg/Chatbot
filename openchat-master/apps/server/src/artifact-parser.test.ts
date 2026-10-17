import { describe, it, expect } from "vitest";
import { parseArtifacts, stripArtifactsForModelContext } from "./artifact-parser.js";

describe("parseArtifacts", () => {
  it("parses a single artifact with all attributes", () => {
    const content = `Here is your page:
<oc-artifact type="html" title="My Page"><h1>Hello</h1></oc-artifact>
Let me know if you need changes.`;

    const { cleanContent, artifacts } = parseArtifacts(content);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].artifactType).toBe("html");
    expect(artifacts[0].title).toBe("My Page");
    expect(artifacts[0].content).toBe("<h1>Hello</h1>");
    expect(cleanContent).toContain("[Artifact: My Page]");
    expect(cleanContent).not.toContain("<oc-artifact");
  });

  it("parses multiple artifacts in one message", () => {
    const content = `Here are two files:
<oc-artifact type="code" title="utils.py" language="python">def hello(): pass</oc-artifact>
And a diagram:
<oc-artifact type="svg" title="Diagram"><svg></svg></oc-artifact>`;

    const { cleanContent, artifacts } = parseArtifacts(content);

    expect(artifacts).toHaveLength(2);
    expect(artifacts[0].artifactType).toBe("code");
    expect(artifacts[0].language).toBe("python");
    expect(artifacts[1].artifactType).toBe("svg");
    expect(cleanContent).toContain("[Artifact: utils.py]");
    expect(cleanContent).toContain("[Artifact: Diagram]");
  });

  it("returns content unchanged when no artifacts present", () => {
    const content = "Just a regular message with no artifacts.";
    const { cleanContent, artifacts } = parseArtifacts(content);

    expect(artifacts).toHaveLength(0);
    expect(cleanContent).toBe(content);
  });

  it("handles artifacts with multiline content", () => {
    const content = `<oc-artifact type="html" title="Page">
<html>
  <body>
    <h1>Title</h1>
  </body>
</html>
</oc-artifact>`;

    const { artifacts } = parseArtifacts(content);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].content).toContain("<h1>Title</h1>");
  });

  it("recovers a truncated (unclosed) artifact so it still renders", () => {
    // Simulates the model hitting its token limit mid-artifact: opening tag,
    // no closing </oc-artifact>.
    const content = `Here is your app:
<oc-artifact type="react" title="App"><div>partial code that got cut off`;
    const { cleanContent, artifacts } = parseArtifacts(content);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].artifactType).toBe("react");
    expect(artifacts[0].title).toBe("App");
    expect(artifacts[0].content).toContain("partial code that got cut off");
    expect(cleanContent).toContain("[Artifact: App]");
    expect(cleanContent).not.toContain("<oc-artifact");
  });

  it("ignores artifacts with invalid type", () => {
    const content = `<oc-artifact type="invalid" title="Bad">content</oc-artifact>`;
    const { artifacts } = parseArtifacts(content);

    expect(artifacts).toHaveLength(0);
  });

  it("preserves surrounding text", () => {
    const content = `Before. <oc-artifact type="markdown" title="Doc"># Hello</oc-artifact> After.`;
    const { cleanContent } = parseArtifacts(content);

    expect(cleanContent).toContain("Before.");
    expect(cleanContent).toContain("After.");
  });
});

describe("stripArtifactsForModelContext", () => {
  it("replaces artifact blocks with text summaries", () => {
    const content = `Here is the page:
<oc-artifact type="html" title="My Page"><h1>Hello</h1></oc-artifact>
What would you like to change?`;

    const result = stripArtifactsForModelContext(content);

    expect(result).toContain('[Generated html artifact: "My Page"]');
    expect(result).not.toContain("<oc-artifact");
    expect(result).toContain("Here is the page:");
  });

  it("handles content with no artifacts", () => {
    const content = "No artifacts here.";
    const result = stripArtifactsForModelContext(content);
    expect(result).toBe(content);
  });
});
