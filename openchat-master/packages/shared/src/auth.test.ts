import { describe, it, expect } from "vitest";
import { signupSchema, loginSchema, settingsUpdateSchema } from "./auth.js";

describe("signupSchema", () => {
  it("accepts valid input", () => {
    const result = signupSchema.safeParse({
      email: "user@example.com",
      password: "securepass123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = signupSchema.safeParse({
      email: "not-an-email",
      password: "securepass123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = signupSchema.safeParse({
      email: "",
      password: "securepass123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 chars", () => {
    const result = signupSchema.safeParse({
      email: "user@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("accepts password at max length (128 chars)", () => {
    const result = signupSchema.safeParse({
      email: "user@example.com",
      password: "a".repeat(128),
    });
    expect(result.success).toBe(true);
  });

  it("rejects password over 128 chars", () => {
    const result = signupSchema.safeParse({
      email: "user@example.com",
      password: "a".repeat(129),
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid input", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "anypassword",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "bad",
      password: "anypassword",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("settingsUpdateSchema", () => {
  it("accepts partial update with theme only", () => {
    const result = settingsUpdateSchema.safeParse({ theme: "dark" });
    expect(result.success).toBe(true);
  });

  it("accepts all fields", () => {
    const result = settingsUpdateSchema.safeParse({
      theme: "system",
      customInstructions: "Be concise",
      defaultModel: "gpt-4",
      memoryEnabled: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (no-op update)", () => {
    const result = settingsUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects invalid theme value", () => {
    const result = settingsUpdateSchema.safeParse({ theme: "blue" });
    expect(result.success).toBe(false);
  });
});
