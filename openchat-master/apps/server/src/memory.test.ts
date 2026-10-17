import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Mock data stores
const mockMemoryItems: Map<string, Record<string, unknown>> = new Map();
const mockUsers: Map<string, Record<string, unknown>> = new Map();
const mockSessions: Map<string, Record<string, unknown>> = new Map();

vi.mock("./db.js", () => ({
  db: {
    insert: (_table: unknown) => ({
      values: (data: Record<string, unknown>) => ({
        returning: () => {
          const item = {
            ...data,
            id: data.id ?? crypto.randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockMemoryItems.set(item.id as string, item);
          return [item];
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: (_cond: unknown) => ({
          limit: () => ({
            orderBy: () => [],
          }),
          orderBy: () => [...mockMemoryItems.values()],
        }),
      }),
    }),
    update: (_table: unknown) => ({
      set: (data: Record<string, unknown>) => ({
        where: () => ({
          returning: () => {
            const updated = { ...data, updatedAt: new Date() };
            return [updated];
          },
        }),
      }),
    }),
    delete: (_table: unknown) => ({
      where: () => ({
        returning: () => {
          const first = mockMemoryItems.values().next().value;
          if (first) {
            mockMemoryItems.delete(first.id as string);
            return [first];
          }
          return [];
        },
      }),
    }),
  },
}));

vi.mock("@openchat/providers", () => ({
  embedText: async () => [0.1, 0.2, 0.3],
}));

vi.mock("./middleware.js", async () => ({
  authMiddleware: async (c: { req: { header: (name: string) => string | undefined }; json: (body: unknown, status?: number) => unknown; set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
    const cookieHeader = c.req.header("cookie") ?? "";
    const match = cookieHeader.match(/session_token=([^;]+)/);
    const token = match?.[1];
    if (!token) return c.json({ error: "Unauthorized" }, 401);
    const [sessionId] = token.split(".");
    const session = mockSessions.get(sessionId);
    if (!session) return c.json({ error: "Unauthorized" }, 401);
    const user = mockUsers.get(session.userId as string);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    c.set("user", { id: user.id, email: user.email, createdAt: user.createdAt });
    await next();
  },
}));

const { default: memory } = await import("./memory.js");

const app = new Hono();
app.route("/api/memory", memory);

describe("GET /api/memory", () => {
  beforeEach(() => {
    mockMemoryItems.clear();
    mockUsers.clear();
    mockSessions.clear();
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/memory");
    expect(res.status).toBe(401);
  });

});

describe("DELETE /api/memory/:id", () => {
  it("returns 401 without auth", async () => {
    const res = await app.request(`/api/memory/${crypto.randomUUID()}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/memory/:id", () => {
  it("returns 401 without auth", async () => {
    const res = await app.request(`/api/memory/${crypto.randomUUID()}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "updated fact" }),
    });
    expect(res.status).toBe(401);
  });
});
