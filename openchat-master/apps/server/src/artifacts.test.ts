import { describe, it, expect, vi } from "vitest";

// Mock DB
vi.mock("./db.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => [],
          orderBy: () => [],
        }),
      }),
    }),
    insert: (_table: unknown) => ({
      values: (data: Record<string, unknown>) => ({
        returning: () => [{ ...data, id: crypto.randomUUID(), createdAt: new Date() }],
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
  },
}));

// Mock auth middleware
vi.mock("./middleware.js", () => ({
  // reason: test stub for Hono context; full typing adds no test value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authMiddleware: async (c: any, next: () => Promise<void>) => {
    const cookieHeader = c.req?.header?.("cookie") ?? "";
    if (!cookieHeader.includes("session_token")) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("user", { id: "user-1", email: "test@test.com" });
    await next();
  },
}));

const { default: artifactsApp } = await import("./artifacts.js");

describe("Artifacts API", () => {
  it("returns 401 without auth cookie", async () => {
    const res = await artifactsApp.request("/conv-1/artifacts");
    expect(res.status).toBe(401);
  });

  it("returns 401 for GET artifact without auth", async () => {
    const res = await artifactsApp.request("/conv-1/artifacts/some-id");
    expect(res.status).toBe(401);
  });

  it("returns 401 for POST version without auth", async () => {
    const res = await artifactsApp.request("/conv-1/artifacts/some-id/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "test" }),
    });
    expect(res.status).toBe(401);
  });

  it("validates body on POST new version (auth bypassed for validation)", async () => {
    const res = await artifactsApp.request("/conv-1/artifacts/some-id/versions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "session_token=fake",
      },
      body: JSON.stringify({}),
    });
    // Validation fails before reaching DB, returns 400
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });
});
