import { describe, it, expect } from "vitest";
import { computeLineDiff } from "./DiffView";

describe("computeLineDiff", () => {
  it("returns all unchanged lines for identical content", () => {
    const diff = computeLineDiff("hello\nworld", "hello\nworld");
    expect(diff).toHaveLength(2);
    expect(diff[0].type).toBe("unchanged");
    expect(diff[1].type).toBe("unchanged");
  });

  it("detects added lines", () => {
    const diff = computeLineDiff("hello", "hello\nworld");
    expect(diff).toHaveLength(2);
    expect(diff[0].type).toBe("unchanged");
    expect(diff[1].type).toBe("added");
    if (diff[1].type === "added") {
      expect(diff[1].line).toBe("world");
    }
  });

  it("detects removed lines", () => {
    const diff = computeLineDiff("hello\nworld", "hello");
    expect(diff).toHaveLength(2);
    expect(diff[0].type).toBe("unchanged");
    expect(diff[1].type).toBe("removed");
    if (diff[1].type === "removed") {
      expect(diff[1].line).toBe("world");
    }
  });

  it("detects changed lines as remove + add", () => {
    const diff = computeLineDiff("hello\nworld", "hello\nearth");
    expect(diff).toHaveLength(3);
    expect(diff[0].type).toBe("unchanged");
    expect(diff[1].type).toBe("removed");
    expect(diff[2].type).toBe("added");
  });

  it("handles empty old content (all added)", () => {
    // "".split("\n") gives [""], so old has 1 empty line
    const diff = computeLineDiff("", "line1\nline2");
    expect(diff.length).toBeGreaterThanOrEqual(2);
    // The two new lines should be added
    const added = diff.filter((d) => d.type === "added");
    expect(added).toHaveLength(2);
  });

  it("handles empty new content (all removed)", () => {
    const diff = computeLineDiff("line1\nline2", "");
    expect(diff.length).toBeGreaterThanOrEqual(2);
    const removed = diff.filter((d) => d.type === "removed");
    expect(removed).toHaveLength(2);
  });

  it("assigns correct line numbers", () => {
    const diff = computeLineDiff("a\nb", "a\nc\nb");
    // a=unchanged, c=added, b=unchanged
    expect(diff).toHaveLength(3);
    expect(diff[0].type).toBe("unchanged");
    if (diff[0].type === "unchanged") {
      expect(diff[0].oldLineNum).toBe(1);
      expect(diff[0].newLineNum).toBe(1);
    }
    expect(diff[1].type).toBe("added");
    if (diff[1].type === "added") {
      expect(diff[1].newLineNum).toBe(2);
    }
    expect(diff[2].type).toBe("unchanged");
    if (diff[2].type === "unchanged") {
      expect(diff[2].oldLineNum).toBe(2);
      expect(diff[2].newLineNum).toBe(3);
    }
  });
});
