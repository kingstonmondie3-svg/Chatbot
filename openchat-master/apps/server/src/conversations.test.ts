import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Mock data stores
const mockConversations: Map<string, Record<string, unknown>> = new Map();
const mockMessages: Array<Record<string, unknown>> = [];
const mockUsers: Map<string, Record<string, unknown>> = new Map();
const mockSessions: Map<string, Record<string, unknown>> = new Map();

vi.mock("./db.js", () => ({
  db: {
    insert: (_table: unknown) => ({
      values: (data: Record<string, unknown>) => ({
        returning: () => {
          if ("userId" in data && "model" in data) {
            // conversations table
            const conv = {
              ...data,
              id: data.id ?? crypto.randomUUID(),
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockConversations.set(conv.id as string, conv);
            return [conv];
          }
          if ("conversationId" in data) {
            // messages table
            const msg = { ...data, id: crypto.randomUUID(), createdAt: new Date() };
            mockMessages.push(msg);
            return [msg];
          }
          return [];
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => ({
            orderBy: () => [],
          }),
          orderBy: () => ({
            limit: () => [...mockConversations.values()],
          }),
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
          // Return deleted conversation
          const first = mockConversations.values().next().value;
          if (first) {
            mockConversations.delete(first.id as string);
            return [first];
          }
          return [];
        },
      }),
    }),
  },
}));

// Mock auth middleware
vi.mock("./middleware.js", async () => {
  return {
    authMiddleware: async (c: { req: { header: (name: string) => string | undefined }; json: (body: unknown, status?: number) => unknown; set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      const cookieHeader = c.req.header("cookie") ?? "";
      const match = cookieHeader.match(/session_token=([^;]+)/);
      const token = match?.[1];
      if (!token) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      const [sessionId] = token.split(".");
      const session = mockSessions.get(sessionId);
      if (!session) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      const user = mockUsers.get(session.userId as string);
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      c.set("user", { id: user.id, email: user.email, createdAt: user.createdAt });
      await next();
    },
  };
});

// Mock orchestrator
vi.mock("./orchestrator.js", () => ({
  generate: async function* () {
    yield { type: "text", delta: "Hello" };
    yield { type: "text", delta: " world" };
    yield { type: "usage", inputTokens: 10, outputTokens: 2 };
    yield { type: "done", finishReason: "stop" };
  },
}));

const { default: conversations } = await import("./conversations.js");

const app = new Hono();
app.route("/api/conversations", conversations);

describe("POST /api/conversations", () => {
  beforeEach(() => {
    mockConversations.clear();
    mockUsers.clear();
    mockSessions.clear();
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it("returns 201 with valid input and auth", async () => {
    // Seed user and session
    const userId = crypto.randomUUID();
    mockUsers.set(userId, { id: userId, email: "test@example.com", createdAt: new Date() });
    mockSessions.set("test-session", { id: "test-session", userId });

    const res = await app.request("/api/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": "session_token=test-session.secret",
      },
      body: JSON.stringify({ model: "gpt-4o-mini" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.model).toBe("gpt-4o-mini");
  });
});

describe("GET /api/conversations", () => {
  it("returns 401 without auth", async () => {
    const res = await app.request("/api/conversations");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/conversations/:id/messages", () => {
  it("returns 401 without auth", async () => {
    const res = await app.request(`/api/conversations/${crypto.randomUUID()}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Hello" }),
    });
    expect(res.status).toBe(401);
  });
});
