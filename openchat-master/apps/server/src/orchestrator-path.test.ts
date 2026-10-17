import { describe, it, expect } from "vitest";
import { walkActivePath } from "./orchestrator.js";

// walkActivePath is the pure in-memory replacement for the old per-ancestor
// N+1 query: load the conversation once, then walk the parent chain here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function msg(id: string, parentId: string | null, t: number): any {
  return { id, parentId, role: "user", content: id, createdAt: new Date(2026, 0, 1, 0, 0, t) };
}

describe("walkActivePath", () => {
  it("returns the chain from root to the given leaf in order", () => {
    const all = [msg("m1", null, 1), msg("m2", "m1", 2), msg("m3", "m2", 3), msg("m4", "m3", 4)];
    expect(walkActivePath(all, "m4").map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it("follows only the branch of the chosen leaf", () => {
    const all = [msg("m1", null, 1), msg("m2", "m1", 2), msg("m3", "m2", 3), msg("m2b", "m1", 5)];
    expect(walkActivePath(all, "m2b").map((m) => m.id)).toEqual(["m1", "m2b"]);
  });

  it("falls back to the most recent message when no leaf is given", () => {
    const all = [msg("m1", null, 1), msg("m2", "m1", 2), msg("m2b", "m1", 9)];
    expect(walkActivePath(all).map((m) => m.id)).toEqual(["m1", "m2b"]);
  });

  it("returns empty for an empty conversation", () => {
    expect(walkActivePath([])).toEqual([]);
  });

  it("returns empty when the given leaf id is missing", () => {
    expect(walkActivePath([msg("m1", null, 1)], "nope")).toEqual([]);
  });

  it("does not infinite-loop on a parent cycle", () => {
    const all = [msg("x", "y", 1), msg("y", "x", 2)];
    expect(walkActivePath(all, "x").length).toBeLessThanOrEqual(2);
  });
});
