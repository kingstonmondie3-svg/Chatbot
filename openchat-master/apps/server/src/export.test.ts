import { describe, it, expect } from "vitest";
import { formatConversationMarkdown } from "./export.js";

describe("formatConversationMarkdown", () => {
  it("formats a single user message", () => {
    const result = formatConversationMarkdown("Test", [
      { role: "user", content: "Hello" },
    ]);

    expect(result).toBe("# Test\n\n---\n\n## User\n\nHello\n");
  });

  it("formats a multi-turn conversation", () => {
    const result = formatConversationMarkdown("Chat", [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
      { role: "user", content: "How are you?" },
      { role: "assistant", content: "Fine, thanks." },
    ]);

    expect(result).toContain("## User\n\nHi");
    expect(result).toContain("## Assistant\n\nHello!");
    expect(result).toContain("## User\n\nHow are you?");
    expect(result).toContain("## Assistant\n\nFine, thanks.");
    // header + 4 messages → 4 separators
    const separators = result.split("---").length - 1;
    expect(separators).toBe(4);
  });

  it("uses 'Conversation' when title is null", () => {
    const result = formatConversationMarkdown(null, [
      { role: "user", content: "Hi" },
    ]);

    expect(result).toMatch(/^# Conversation\n/);
  });

  it("excludes system messages", () => {
    const result = formatConversationMarkdown("T", [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
    ]);

    expect(result).not.toContain("System");
    expect(result).not.toContain("You are helpful.");
    expect(result).toContain("## User\n\nHello");
  });

  it("excludes tool messages", () => {
    const result = formatConversationMarkdown("T", [
      { role: "user", content: "Search for X" },
      { role: "tool", content: '{"results": []}' },
      { role: "assistant", content: "No results found." },
    ]);

    expect(result).not.toContain("Tool");
    expect(result).not.toContain("## Tool");
    expect(result).toContain("## Assistant\n\nNo results found.");
  });

  it("excludes empty messages", () => {
    const result = formatConversationMarkdown("T", [
      { role: "user", content: "" },
      { role: "assistant", content: "Reply" },
    ]);

    expect(result).not.toContain("## User");
    expect(result).toContain("## Assistant\n\nReply");
  });

  it("preserves assistant Markdown verbatim", () => {
    const codeBlock = 'Here is code:\n\n```ts\nconsole.log("hi");\n```';
    const result = formatConversationMarkdown("T", [
      { role: "assistant", content: codeBlock },
    ]);

    expect(result).toContain('```ts\nconsole.log("hi");\n```');
  });

  it("does not add a trailing separator after the last message", () => {
    const result = formatConversationMarkdown("T", [
      { role: "user", content: "Hi" },
    ]);

    // Should end with the message content + newline, not with ---\n
    expect(result).not.toMatch(/---\n$/);
    expect(result).toMatch(/Hi\n$/);
  });
});
