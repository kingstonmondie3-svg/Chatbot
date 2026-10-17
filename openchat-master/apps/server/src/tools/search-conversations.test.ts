import { describe, it, expect, vi } from "vitest";
import type { ToolExecutionContext } from "./types.js";

vi.mock("../db.js", () => ({
  db: {
    execute: async () => [
      {
        content: "User discussed React hooks patterns",
        conversation_title: "React best practices",
        conversation_created_at: new Date("2025-01-15"),
        similarity: 0.85,
      },
    ],
  },
}));

vi.mock("@openchat/providers", () => ({
  embedText: async () => [0.1, 0.2, 0.3],
}));

const { SearchConversationsTool } = await import("./search-conversations.js");

const ctx: ToolExecutionContext = {
  conversationId: "conv-1",
  userId: "user-1",
};

describe("SearchConversationsTool", () => {
  it("returns conversation search results", async () => {
    const tool = new SearchConversationsTool();
    const def = tool.getDefinition();

    expect(def.name).toBe("search_conversations");
    const params = def.parameters as { properties: { query: unknown }; required: string[] };
    expect(params.properties.query).toBeDefined();
    expect(params.required).toContain("query");

    const output = await tool.execute({ query: "React hooks" }, ctx);
    const parsed = JSON.parse(output);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].content).toBe("User discussed React hooks patterns");
    expect(parsed.results[0].conversationTitle).toBe("React best practices");
    expect(parsed.results[0].similarity).toBe(0.85);
  });

  it("returns error for missing query", async () => {
    const tool = new SearchConversationsTool();
    const output = await tool.execute({}, ctx);
    const parsed = JSON.parse(output);
    expect(parsed.error).toBeDefined();
  });

  it("returns error for non-string query", async () => {
    const tool = new SearchConversationsTool();
    const output = await tool.execute({ query: 123 }, ctx);
    const parsed = JSON.parse(output);
    expect(parsed.error).toBeDefined();
  });
});
