import { eq } from "drizzle-orm";
import { resolveProvider } from "@openchat/providers";
import { chunkText, embedBatch, embeddingsConfigured } from "@openchat/providers";
import { db } from "./db.js";
import { memoryItems, convChunks, conversations, userSettings } from "../../../drizzle/schema.js";

const EXTRACTION_MODEL = "gpt-4o-mini";

const EXTRACTION_PROMPT = `You are a memory extraction system. Analyze the following conversation and extract durable personal facts about the user — preferences, context, expertise, recurring topics, and personal details they've shared.

Ignore ephemeral details (what they asked for help with right now, temporary questions, code output).

Return ONLY a JSON array of strings, each a single self-contained fact. Example:
["User prefers TypeScript over JavaScript", "User is a software engineer at a startup", "User has two cats named Luna and Pixel"]

If no durable facts were shared, return an empty array: []`;

/** Extract facts from a conversation and store them as memory items. Also chunk the conversation for search. */
export async function extractAndStoreMemory(
  userId: string,
  conversationId: string,
  messages: Array<{ role: string; content: string }>,
): Promise<void> {
  // Memory extraction needs an embedding provider (and an OpenAI extraction
  // model). With no key configured, skip quietly instead of throwing per turn.
  if (!embeddingsConfigured()) return;

  // Check memory is enabled and conversation is not incognito
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (settings && !settings.memoryEnabled) return;

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (conv?.incognito) return;

  // Build conversation text for extraction
  const conversationText = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  // Extract facts via LLM
  try {
    const provider = resolveProvider(EXTRACTION_MODEL);
    let responseText = "";

    for await (const event of provider.stream({
      model: EXTRACTION_MODEL,
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: conversationText },
      ],
      temperature: 0.3,
      maxTokens: 1000,
    })) {
      if (event.type === "text") {
        responseText += event.delta;
      }
    }

    // Parse the JSON array from the response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const facts: string[] = JSON.parse(jsonMatch[0]);

      if (facts.length > 0) {
        // Embed all facts in batch
        const embeddings = await embedBatch(facts);

        // Insert memory items
        const rows = facts.map((content, i) => ({
          userId,
          conversationId,
          content,
          embedding: embeddings[i],
          source: "conversation" as const,
        }));

        await db.insert(memoryItems).values(rows);
      }
    }
  } catch (err) {
    console.error("Memory extraction failed:", err);
  }

  // Chunk and embed conversation for search_conversations tool
  try {
    const chunks = chunkText(conversationText);

    if (chunks.length > 0) {
      const embeddings = await embedBatch(chunks);

      const rows = chunks.map((content, i) => ({
        conversationId,
        userId,
        chunkIndex: i,
        content,
        embedding: embeddings[i],
      }));

      await db.insert(convChunks).values(rows);
    }
  } catch (err) {
    console.error("Conversation chunking failed:", err);
  }
}
