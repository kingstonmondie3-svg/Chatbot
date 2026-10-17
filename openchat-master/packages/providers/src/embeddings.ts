import OpenAI from "openai";

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const CHUNK_SIZE = 1000; // characters per chunk
const CHUNK_OVERLAP = 200; // overlap between chunks

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for embeddings");
    client = new OpenAI({ apiKey });
  }
  return client;
}

/**
 * Whether an embedding provider is configured. Optional, background features
 * (memory, conversation search) should check this and skip quietly rather than
 * throwing on every request when no key is set.
 */
export function embeddingsConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Split text into overlapping chunks. */
export function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

/** Embed a single text string. Returns a float array. */
export async function embedText(text: string): Promise<number[]> {
  const res = await getClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return res.data[0].embedding;
}

/** Embed multiple text strings in one batch call. */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await getClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return res.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}
