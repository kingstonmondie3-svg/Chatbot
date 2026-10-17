import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GenerationEvent } from "@openchat/shared";

let streamChunks: unknown[] = [];

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: async () =>
          (async function* () {
            for (const chunk of streamChunks) yield chunk;
          })(),
      },
    },
  })),
}));

const { DeepSeekProvider } = await import("./deepseek.js");

async function collect(stream: AsyncIterable<GenerationEvent>): Promise<GenerationEvent[]> {
  const events: GenerationEvent[] = [];
  for await (const e of stream) events.push(e);
  return events;
}

const P = "｜｜DSML｜｜"; // ｜ = U+FF5C

describe("streamOpenAICompatible — in-content (DSML) tool calls", () => {
  beforeEach(() => {
    streamChunks = [];
  });

  it("converts DeepSeek DSML markup in content into a tool_call without leaking text", async () => {
    streamChunks = [
      { choices: [{ delta: { content: "Let me search. " } }] },
      { choices: [{ delta: { content: `<${P}tool_calls><${P}invoke name="web_search">` } }] },
      { choices: [{ delta: { content: `<${P}parameter name="query" string="true">node lts</${P}parameter>` } }] },
      { choices: [{ delta: { content: `</${P}invoke></${P}tool_calls>` } }] },
      { choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 2 } },
    ];

    const events = await collect(
      new DeepSeekProvider("k").stream({ model: "deepseek-v4-pro", messages: [{ role: "user", content: "hi" }] }),
    );

    const text = events.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta).join("");
    expect(text).toContain("Let me search.");
    expect(text).not.toMatch(/DSML|web_search|query|tool_calls/);

    const calls = events.filter((e) => e.type === "tool_call") as Array<{ name: string; args: unknown }>;
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("web_search");
    expect(calls[0].args).toEqual({ query: "node lts" });
  });

  it("leaves a normal text-only response untouched", async () => {
    streamChunks = [
      { choices: [{ delta: { content: "The answer is 5 < 10." } }] },
      { choices: [{ delta: {}, finish_reason: "stop" }] },
    ];
    const events = await collect(
      new DeepSeekProvider("k").stream({ model: "deepseek-v4-pro", messages: [{ role: "user", content: "hi" }] }),
    );
    const text = events.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta).join("");
    expect(text).toBe("The answer is 5 < 10.");
    expect(events.some((e) => e.type === "tool_call")).toBe(false);
  });
});
