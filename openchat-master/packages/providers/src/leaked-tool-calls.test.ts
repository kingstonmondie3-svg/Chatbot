import { describe, it, expect } from "vitest";
import { LeakedToolCallStream, parseLeakedToolCalls } from "./leaked-tool-calls.js";

// Exact DeepSeek V4 "DSML" markup (｜ = U+FF5C), reconstructed from a real leak.
const P = "｜｜DSML｜｜";
const BLOCK =
  `<${P}tool_calls><${P}invoke name="web_search">` +
  `<${P}parameter name="query" string="true">Claude.ai sidebar icons SVG conversation history UI design</${P}parameter>` +
  `</${P}invoke></${P}tool_calls>`;

function run(text: string, size: number) {
  const s = new LeakedToolCallStream();
  let emitted = "";
  for (let i = 0; i < text.length; i += size) emitted += s.push(text.slice(i, i + size));
  emitted += s.flush();
  return { emitted, calls: s.calls };
}

describe("parseLeakedToolCalls", () => {
  it("extracts name + parameters from a DSML block", () => {
    expect(parseLeakedToolCalls(BLOCK)).toEqual([
      { name: "web_search", args: { query: "Claude.ai sidebar icons SVG conversation history UI design" } },
    ]);
  });
});

describe("LeakedToolCallStream", () => {
  it("suppresses the DSML block and parses the call (whole)", () => {
    const { emitted, calls } = run(BLOCK, 10_000);
    expect(emitted.trim()).toBe("");
    expect(calls).toEqual([
      { name: "web_search", args: { query: "Claude.ai sidebar icons SVG conversation history UI design" } },
    ]);
  });

  it("never leaks the block when split character-by-character", () => {
    const { emitted, calls } = run(`Let me look that up.\n${BLOCK}`, 1);
    expect(emitted).toContain("Let me look that up.");
    expect(emitted).not.toMatch(/DSML|web_search|query|tool_calls/);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("web_search");
  });

  it("passes ordinary prose through unchanged (incl. a bare '<')", () => {
    const text = "The value 5 < 10 is true, and a > b sometimes.";
    expect(run(text, 3).emitted).toBe(text);
    expect(run(text, 3).calls).toHaveLength(0);
  });

  it("does not touch ordinary code fences", () => {
    const md = "Here:\n```js\nif (x < y) return;\n```\ndone";
    const { emitted, calls } = run(md, 4);
    expect(emitted).toBe(md);
    expect(calls).toHaveLength(0);
  });

  it("handles a block with no leading text", () => {
    const { emitted, calls } = run(BLOCK, 5);
    expect(emitted.trim()).toBe("");
    expect(calls[0].name).toBe("web_search");
  });

  it("does not swallow the answer when a marker matches but no call parses", () => {
    // A stray tag that trips the opening heuristic but holds no real tool call.
    // The model's text must still come through (never an empty response).
    const text = `Here is the answer.<${P}tool_calls>this is not valid markup, just words</${P}tool_calls> And the rest of the reply.`;
    const { emitted, calls } = run(text, 7);
    expect(calls).toHaveLength(0);
    expect(emitted).toContain("Here is the answer.");
    expect(emitted).toContain("And the rest of the reply.");
  });

  it("does not trigger on a fullwidth pipe in ordinary prose", () => {
    const text = "Options: A ｜ B ｜ C are all valid choices.";
    const { emitted, calls } = run(text, 4);
    expect(emitted).toBe(text);
    expect(calls).toHaveLength(0);
  });
});
