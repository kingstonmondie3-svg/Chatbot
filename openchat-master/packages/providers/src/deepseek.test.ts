import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GenerationEvent } from "@openchat/shared";

// Capture the args passed to chat.completions.create, and let each test
// supply the chunks the mocked stream yields.
let lastCreateArgs: { messages: unknown[] } | null = null;
let streamChunks: unknown[] = [];

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: async (args: { messages: unknown[] }) => {
          lastCreateArgs = args;
          return (async function* () {
            for (const chunk of streamChunks) yield chunk;
          })();
        },
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

describe("DeepSeekProvider thinking mode", () => {
  beforeEach(() => {
    lastCreateArgs = null;
    streamChunks = [];
  });

  it("emits a reasoning event for reasoning_content deltas", async () => {
    streamChunks = [
      { choices: [{ delta: { reasoning_content: "let me think" } }] },
      { choices: [{ delta: { content: "hello" } }] },
      { choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 2 } },
    ];

    const provider = new DeepSeekProvider("test-key");
    const events = await collect(
      provider.stream({ model: "deepseek-v4-pro", messages: [{ role: "user", content: "hi" }] }),
    );

    expect(events).toContainEqual({ type: "reasoning", delta: "let me think" });
    expect(events).toContainEqual({ type: "text", delta: "hello" });
  });

  it("replays reasoning_content on a tool-call assistant message", async () => {
    streamChunks = [{ choices: [{ delta: { content: "done" }, finish_reason: "stop" }] }];

    const provider = new DeepSeekProvider("test-key");
    await collect(
      provider.stream({
        model: "deepseek-v4-pro",
        messages: [
          { role: "user", content: "run it" },
          {
            role: "assistant",
            content: "",
            toolMetadata: {
              toolCalls: [{ id: "t1", name: "run_code", args: { code: "1+1" } }],
              reasoningContent: "my chain of thought",
            },
          },
          { role: "tool", content: "2", toolCallId: "t1", toolName: "run_code" },
        ],
      }),
    );

    const sent = lastCreateArgs?.messages as Array<Record<string, unknown>>;
    const assistant = sent.find((m) => m.role === "assistant");
    expect(assistant?.reasoning_content).toBe("my chain of thought");
    expect(assistant?.tool_calls).toBeDefined();
  });

  it("yields a clean error (no throw) when no API key is configured", async () => {
    const provider = new DeepSeekProvider("");
    const events = await collect(
      provider.stream({ model: "deepseek-v4-pro", messages: [{ role: "user", content: "hi" }] }),
    );
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("error");
    expect((events[0] as { message: string }).message).toMatch(/DEEPSEEK_API_KEY/);
  });

  it("omits reasoning_content when none was stored", async () => {
    streamChunks = [{ choices: [{ delta: { content: "ok" }, finish_reason: "stop" }] }];

    const provider = new DeepSeekProvider("test-key");
    await collect(
      provider.stream({
        model: "deepseek-v4-pro",
        messages: [
          {
            role: "assistant",
            content: "",
            toolMetadata: { toolCalls: [{ id: "t1", name: "run_code", args: {} }] },
          },
          { role: "tool", content: "x", toolCallId: "t1", toolName: "run_code" },
        ],
      }),
    );

    const sent = lastCreateArgs?.messages as Array<Record<string, unknown>>;
    const assistant = sent.find((m) => m.role === "assistant");
    expect(assistant).toBeDefined();
    expect("reasoning_content" in (assistant ?? {})).toBe(false);
  });
});
