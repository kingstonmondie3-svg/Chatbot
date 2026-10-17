import { describe, it, expect, vi } from "vitest";
import { WebSearchTool } from "./web-search.js";
import type { SearchBackend, SearchResult } from "./web-search.js";
import type { ToolExecutionContext } from "./types.js";

function makeMockBackend(results: SearchResult[]): SearchBackend {
  return {
    search: vi.fn(async () => results),
  };
}

const ctx: ToolExecutionContext = {
  conversationId: "conv-1",
  userId: "user-1",
};

describe("WebSearchTool", () => {
  it("returns search results as JSON", async () => {
    const results: SearchResult[] = [
      { title: "Example", url: "https://example.com", snippet: "An example" },
    ];
    const tool = new WebSearchTool(makeMockBackend(results));
    const def = tool.getDefinition();

    expect(def.name).toBe("web_search");
    const params = def.parameters as { properties: { query: unknown } };
    expect(params.properties.query).toBeDefined();

    const output = await tool.execute({ query: "test query" }, ctx);
    const parsed = JSON.parse(output);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].title).toBe("Example");
  });

  it("returns error for missing query", async () => {
    const tool = new WebSearchTool(makeMockBackend([]));
    const output = await tool.execute({}, ctx);
    const parsed = JSON.parse(output);
    expect(parsed.error).toBeDefined();
  });

  it("returns error for non-string query", async () => {
    const tool = new WebSearchTool(makeMockBackend([]));
    const output = await tool.execute({ query: 123 }, ctx);
    const parsed = JSON.parse(output);
    expect(parsed.error).toBeDefined();
  });

  it("returns error when backend throws", async () => {
    const backend: SearchBackend = {
      search: async () => {
        throw new Error("API down");
      },
    };
    const tool = new WebSearchTool(backend);
    const output = await tool.execute({ query: "test" }, ctx);
    const parsed = JSON.parse(output);
    expect(parsed.error).toContain("API down");
  });
});
