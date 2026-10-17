import { describe, it, expect } from "vitest";
import { ToolProtocolStream, buildToolProtocolPrompt } from "./tool-protocol.js";

/** Feed `text` through the filter in chunks of `size` chars; return emitted text. */
function run(text: string, size: number): { emitted: string; stream: ToolProtocolStream } {
  const stream = new ToolProtocolStream();
  let emitted = "";
  for (let i = 0; i < text.length; i += size) {
    emitted += stream.push(text.slice(i, i + size));
  }
  emitted += stream.flush();
  return { emitted, stream };
}

const BLOCK = '```tool_call\n{"name": "web_search", "args": {"query": "openchat"}}\n```';

describe("ToolProtocolStream", () => {
  it("passes ordinary prose through unchanged", () => {
    const { emitted, stream } = run("Hello, how can I help you today?", 5);
    expect(emitted).toBe("Hello, how can I help you today?");
    expect(stream.calls).toHaveLength(0);
  });

  it("extracts a tool_call block and suppresses its text", () => {
    const { emitted, stream } = run(BLOCK, 1000);
    expect(emitted.trim()).toBe("");
    expect(stream.calls).toEqual([{ name: "web_search", args: { query: "openchat" } }]);
  });

  it("never leaks a block even when split character-by-character", () => {
    const { emitted, stream } = run(BLOCK, 1);
    expect(emitted).not.toMatch(/web_search|query|tool_call/);
    expect(stream.calls).toEqual([{ name: "web_search", args: { query: "openchat" } }]);
  });

  it("emits surrounding prose but not the block", () => {
    const { emitted, stream } = run(`Let me look that up.\n${BLOCK}\nDone.`, 3);
    expect(emitted).toContain("Let me look that up.");
    expect(emitted).toContain("Done.");
    expect(emitted).not.toMatch(/web_search|query/);
    expect(stream.calls).toHaveLength(1);
  });

  it("does NOT suppress ordinary code fences", () => {
    const md = "Here is code:\n```js\nconsole.log(1);\n```\nThat's it.";
    const { emitted, stream } = run(md, 4);
    expect(emitted).toBe(md);
    expect(stream.calls).toHaveLength(0);
  });

  it("handles multiple tool calls", () => {
    const two = `${BLOCK}\nthinking\n\`\`\`tool_call\n{"name": "run_code", "args": {"code": "1+1"}}\n\`\`\``;
    const { stream } = run(two, 7);
    expect(stream.calls.map((c) => c.name)).toEqual(["web_search", "run_code"]);
  });

  it("ignores malformed JSON without crashing or leaking", () => {
    const bad = '```tool_call\n{not valid json}\n```';
    const { emitted, stream } = run(bad, 2);
    expect(stream.calls).toHaveLength(0);
    expect(emitted).not.toContain("not valid json");
  });

  it("accepts an `arguments` alias for args", () => {
    const blk = '```tool_call\n{"name": "web_search", "arguments": {"query": "x"}}\n```';
    const { stream } = run(blk, 1000);
    expect(stream.calls).toEqual([{ name: "web_search", args: { query: "x" } }]);
  });
});

describe("buildToolProtocolPrompt", () => {
  it("lists each tool with its parameters", () => {
    const prompt = buildToolProtocolPrompt([
      { name: "web_search", description: "Search the web", parameters: { type: "object" } },
    ]);
    expect(prompt).toContain("tool_call");
    expect(prompt).toContain("web_search");
    expect(prompt).toContain("Search the web");
  });
});
