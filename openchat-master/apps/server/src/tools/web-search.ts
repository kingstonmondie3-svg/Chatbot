import type { ToolDefinition } from "@openchat/shared";
import type { Tool, ToolExecutionContext } from "./types.js";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchBackend {
  search(query: string, maxResults?: number): Promise<SearchResult[]>;
}

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
}

export class SerperBackend implements SearchBackend {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.SERPER_API_KEY ?? "";
  }

  async search(query: string, maxResults = 5): Promise<SearchResult[]> {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: maxResults }),
    });

    if (!res.ok) {
      throw new Error(`Serper API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { organic?: SerperOrganicResult[] };
    return (data.organic ?? []).slice(0, maxResults).map((r) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
    }));
  }
}

export class WebSearchTool implements Tool {
  private backend: SearchBackend;

  constructor(backend?: SearchBackend) {
    this.backend = backend ?? new SerperBackend();
  }

  getDefinition(): ToolDefinition {
    return {
      name: "web_search",
      description:
        "Search the web for current information. Returns titles, URLs, and snippets. Use this when you need up-to-date facts, news, or information not in your training data.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query",
          },
        },
        required: ["query"],
      },
    };
  }

  async execute(
    args: Record<string, unknown>,
    _context: ToolExecutionContext,
  ): Promise<string> {
    const query = args.query;
    if (!query || typeof query !== "string") {
      return JSON.stringify({ error: "Missing or invalid query parameter" });
    }

    try {
      const results = await this.backend.search(query, 5);
      return JSON.stringify({ results });
    } catch (err) {
      return JSON.stringify({ error: String(err) });
    }
  }
}
