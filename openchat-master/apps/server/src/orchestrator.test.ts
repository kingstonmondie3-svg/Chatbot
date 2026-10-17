import { describe, it, expect, vi } from "vitest";

// Mock DB
const mockMessages: Array<Record<string, unknown>> = [];

vi.mock("./db.js", () => ({
  db: {
    select: () => ({
      from: (_table: unknown) => ({
        where: (_condition: unknown) => ({
          limit: (_n: number) => ({
            orderBy: (_order: unknown) => {
              // For settings lookup
              return [];
            },
          }),
          orderBy: (_order: unknown) => mockMessages.slice(),
        }),
      }),
    }),
    insert: (_table: unknown) => ({
      values: (data: Record<string, unknown>) => ({
        returning: () => {
          if ("conversationId" in data) {
            const msg = { ...data, id: crypto.randomUUID(), createdAt: new Date() };
            mockMessages.push(msg);
            return [msg];
          }
          return [data];
        },
      }),
    }),
    update: (_table: unknown) => ({
      set: (_data: Record<string, unknown>) => ({
        where: (_condition: unknown) => Promise.resolve(),
      }),
    }),
  },
}));

// Mock provider
vi.mock("@openchat/providers", () => ({
  resolveProvider: () => ({
    id: "mock",
    listModels: async () => [],
    stream: async function* () {
      yield { type: "text", delta: "Hello" };
      yield { type: "text", delta: " world" };
      yield { type: "usage", inputTokens: 10, outputTokens: 2 };
      yield { type: "done", finishReason: "stop" };
    },
  }),
  embedText: async () => [0.1, 0.2, 0.3],
}));

// Import after mocks
const { buildSystemPrompt } = await import("./orchestrator.js");

describe("buildSystemPrompt", () => {
  it("returns base prompt without custom instructions", () => {
    const result = buildSystemPrompt();
    expect(result).toContain("You are a helpful assistant.");
    expect(result).toContain("<oc-artifact");
  });

  it("appends custom instructions", () => {
    const result = buildSystemPrompt("Be concise.");
    expect(result).toContain("Be concise.");
    expect(result).toContain("<oc-artifact");
  });

  it("handles null custom instructions", () => {
    const result = buildSystemPrompt(null);
    expect(result).toContain("You are a helpful assistant.");
    expect(result).toContain("<oc-artifact");
  });

  it("prepends project custom instructions before user custom instructions", () => {
    const result = buildSystemPrompt("User instructions.", null, "Project instructions.");
    const projectIdx = result.indexOf("Project instructions.");
    const userIdx = result.indexOf("User instructions.");
    expect(projectIdx).toBeGreaterThan(0);
    expect(userIdx).toBeGreaterThan(projectIdx);
  });

  it("injects RAG context with source citations", () => {
    const ragContext = [
      { content: "The answer is 42.", filename: "faq.txt", similarity: 0.95 },
      { content: "Related info here.", filename: "docs.md", similarity: 0.80 },
    ];
    const result = buildSystemPrompt(null, null, null, ragContext);
    expect(result).toContain("[Source: faq.txt]");
    expect(result).toContain("The answer is 42.");
    expect(result).toContain("[Source: docs.md]");
  });

  it("injects memory context with personal facts", () => {
    const memoryContext = [
      { content: "User prefers dark mode", similarity: 0.85 },
      { content: "User is a software engineer", similarity: 0.72 },
    ];
    const result = buildSystemPrompt(null, null, null, [], memoryContext);
    expect(result).toContain("previous conversations");
    expect(result).toContain("User prefers dark mode");
    expect(result).toContain("User is a software engineer");
  });

  it("appends response style instruction for concise", () => {
    const result = buildSystemPrompt(null, null, null, [], [], "concise");
    expect(result).toContain("brief and to the point");
  });

  it("does not append instruction for balanced style", () => {
    const result = buildSystemPrompt(null, null, null, [], [], "balanced");
    expect(result).not.toContain("brief and to the point");
    expect(result).not.toContain("thorough");
  });
});
