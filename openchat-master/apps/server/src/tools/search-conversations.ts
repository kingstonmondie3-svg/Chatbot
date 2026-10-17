import { sql } from "drizzle-orm";
import type { ToolDefinition } from "@openchat/shared";
import type { Tool, ToolExecutionContext } from "./types.js";
import { embedText } from "@openchat/providers";
import { db } from "../db.js";

export class SearchConversationsTool implements Tool {
  getDefinition(): ToolDefinition {
    return {
      name: "search_conversations",
      description:
        "Search the user's past conversation history for relevant information. Returns snippets from previous conversations that match the query. Use this when the user asks about something they discussed before.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "What to search for",
          },
        },
        required: ["query"],
      },
    };
  }

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<string> {
    const query = args.query;
    if (!query || typeof query !== "string") {
      return JSON.stringify({ error: "Missing or invalid query parameter" });
    }

    try {
      const queryEmbedding = await embedText(query);

      const results = await db.execute(sql`
        SELECT
          cc.content,
          c.title AS conversation_title,
          c.created_at AS conversation_created_at,
          1 - (cc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) AS similarity
        FROM conv_chunks cc
        JOIN conversations c ON c.id = cc.conversation_id
        WHERE cc.user_id = ${context.userId}
        ORDER BY cc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT 5
      `);

      return JSON.stringify({
        results: (results as unknown as Array<{
          content: string;
          conversation_title: string | null;
          conversation_created_at: Date;
          similarity: number;
        }>).map((r) => ({
          content: r.content,
          conversationTitle: r.conversation_title ?? "Untitled",
          similarity: r.similarity,
          createdAt: r.conversation_created_at.toISOString(),
        })),
      });
    } catch (err) {
      return JSON.stringify({ error: String(err) });
    }
  }
}
