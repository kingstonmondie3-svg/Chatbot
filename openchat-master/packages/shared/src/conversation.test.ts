import { describe, it, expect } from "vitest";
import {
  conversationParamsSchema,
  createConversationSchema,
  updateConversationSchema,
  sendMessageSchema,
  editMessageSchema,
  conversationSearchSchema,
} from "./conversation.js";

describe("createConversationSchema", () => {
  it("accepts empty object (all optional)", () => {
    const result = createConversationSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts model only", () => {
    const result = createConversationSchema.safeParse({ model: "gpt-4o" });
    expect(result.success).toBe(true);
  });

  it("accepts all fields", () => {
    const result = createConversationSchema.safeParse({
      model: "gpt-4o",
      params: { temperature: 0.7 },
      title: "My Chat",
    });
    expect(result.success).toBe(true);
  });

  it("rejects title over 200 chars", () => {
    const result = createConversationSchema.safeParse({
      title: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

describe("updateConversationSchema", () => {
  it("accepts partial update", () => {
    const result = updateConversationSchema.safeParse({ pinned: true });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = updateConversationSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("sendMessageSchema", () => {
  it("accepts valid content", () => {
    const result = sendMessageSchema.safeParse({ content: "Hello!" });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = sendMessageSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing content", () => {
    const result = sendMessageSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts content with parentId", () => {
    const result = sendMessageSchema.safeParse({
      content: "Hello!",
      parentId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid parentId", () => {
    const result = sendMessageSchema.safeParse({
      content: "Hello!",
      parentId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("conversationParamsSchema", () => {
  it("accepts empty object", () => {
    const result = conversationParamsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts all fields", () => {
    const result = conversationParamsSchema.safeParse({
      temperature: 0.7,
      maxTokens: 4096,
      systemPrompt: "You are helpful.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects temperature over 2", () => {
    const result = conversationParamsSchema.safeParse({ temperature: 2.5 });
    expect(result.success).toBe(false);
  });

  it("rejects negative temperature", () => {
    const result = conversationParamsSchema.safeParse({ temperature: -0.1 });
    expect(result.success).toBe(false);
  });

  it("rejects maxTokens over 128000", () => {
    const result = conversationParamsSchema.safeParse({ maxTokens: 200000 });
    expect(result.success).toBe(false);
  });
});

describe("editMessageSchema", () => {
  it("accepts valid content", () => {
    const result = editMessageSchema.safeParse({ content: "Edited message" });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = editMessageSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });
});

describe("conversationSearchSchema", () => {
  it("accepts valid query", () => {
    const result = conversationSearchSchema.safeParse({ q: "hello" });
    expect(result.success).toBe(true);
  });

  it("rejects empty query", () => {
    const result = conversationSearchSchema.safeParse({ q: "" });
    expect(result.success).toBe(false);
  });

  it("rejects query over 200 chars", () => {
    const result = conversationSearchSchema.safeParse({ q: "a".repeat(201) });
    expect(result.success).toBe(false);
  });
});
