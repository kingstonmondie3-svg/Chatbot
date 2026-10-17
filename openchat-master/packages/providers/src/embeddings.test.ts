import { describe, it, expect } from "vitest";
import { chunkText } from "./embeddings.js";

describe("chunkText", () => {
  it("returns single chunk for short text", () => {
    const text = "Hello world";
    const chunks = chunkText(text);
    expect(chunks).toEqual(["Hello world"]);
  });

  it("splits long text into overlapping chunks", () => {
    const text = "a".repeat(2500);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1000);
    }
    expect(chunks[chunks.length - 1].length).toBeLessThanOrEqual(1000);
  });

  it("produces chunks with overlap", () => {
    const text = "abcdefghij".repeat(150); // 1500 chars
    const chunks = chunkText(text);
    expect(chunks.length).toBe(2);
    expect(chunks[1].startsWith(chunks[0].slice(800))).toBe(true);
  });
});
