import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Mock data stores
const mockProjects: Map<string, Record<string, unknown>> = new Map();
const mockUsers: Map<string, Record<string, unknown>> = new Map();
const mockSessions: Map<string, Record<string, unknown>> = new Map();

vi.mock("./db.js", () => ({
  db: {
    insert: (_table: unknown) => ({
      values: (data: Record<string, unknown>) => ({
        returning: () => {
          const project = {
            ...data,
            id: data.id ?? crypto.randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockProjects.set(project.id as string, project);
          return [project];
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
            limit: () => [...mockProjects.values()],
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
          const first = mockProjects.values().next().value;
          if (first) {
            mockProjects.delete(first.id as string);
            return [first];
          }
          return [];
        },
      }),
    }),
  },
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

const { default: projects } = await import("./projects.js");

const app = new Hono();
app.route("/api/projects", projects);

describe("POST /api/projects", () => {
  beforeEach(() => {
    mockProjects.clear();
    mockUsers.clear();
    mockSessions.clear();
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test" }),
    });
    expect(res.status).toBe(401);
  });

  it("creates a project with valid input", async () => {
    const userId = crypto.randomUUID();
    mockUsers.set(userId, { id: userId, email: "test@example.com", createdAt: new Date() });
    mockSessions.set("test-session", { id: "test-session", userId });

    const res = await app.request("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": "session_token=test-session.secret",
      },
      body: JSON.stringify({ name: "My Project", description: "A test project" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("My Project");
    expect(body.description).toBe("A test project");
  });

  it("returns 400 with empty name", async () => {
    const userId = crypto.randomUUID();
    mockUsers.set(userId, { id: userId, email: "test@example.com", createdAt: new Date() });
    mockSessions.set("test-session", { id: "test-session", userId });

    const res = await app.request("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": "session_token=test-session.secret",
      },
      body: JSON.stringify({ name: "" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/projects", () => {
  it("returns 401 without auth", async () => {
    const res = await app.request("/api/projects");
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/projects/:id", () => {
  it("returns 401 without auth", async () => {
    const res = await app.request(`/api/projects/${crypto.randomUUID()}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });
});
