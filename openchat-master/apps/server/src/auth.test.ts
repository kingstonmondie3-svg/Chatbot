import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Mock db - track stored data
const mockUsers: Map<string, { id: string; email: string; passwordHash: string; createdAt: Date }> = new Map();
const mockSessions: Map<string, { id: string; secretHash: string; userId: string; expiresAt: Date }> = new Map();
const mockSettings: Map<string, { userId: string; theme: string; customInstructions: string | null; defaultModel: string | null; memoryEnabled: boolean }> = new Map();

vi.mock("./db.js", () => ({
  db: {
    insert: (_table: unknown) => ({
      values: (data: Record<string, unknown>) => ({
        returning: () => {
          // Determine which table based on data shape
          if ("passwordHash" in data) {
            // users table
            const user = { ...data, id: data.id ?? crypto.randomUUID(), createdAt: new Date() } as { id: string; email: string; passwordHash: string; createdAt: Date };
            mockUsers.set(user.id, user);
            return [user];
          }
          if ("secretHash" in data) {
            // sessions table
            const session = { ...data } as { id: string; secretHash: string; userId: string; expiresAt: Date };
            mockSessions.set(session.id, session);
            return [session];
          }
          if ("userId" in data && !("secretHash" in data)) {
            // userSettings table
            const settings = {
              userId: data.userId,
              theme: data.theme ?? "system",
              customInstructions: data.customInstructions ?? null,
              defaultModel: data.defaultModel ?? null,
              memoryEnabled: data.memoryEnabled ?? true,
            } as { userId: string; theme: string; customInstructions: string | null; defaultModel: string | null; memoryEnabled: boolean };
            mockSettings.set(settings.userId, settings);
            return [settings];
          }
          return [];
        },
      }),
    }),
    select: () => ({
      from: (_table: unknown) => ({
        where: (_condition: unknown) => ({
          limit: (_n: number) => {
            // We need to determine which table and filter based on the condition
            // This is a simplified mock that works for our test patterns
            return [];
          },
        }),
      }),
    }),
    update: (_table: unknown) => ({
      set: (data: Record<string, unknown>) => ({
        where: (_condition: unknown) => ({
          returning: () => {
            // Find the settings by userId
            const userId = data.userId as string ?? [...mockSettings.keys()][0];
            const existing = mockSettings.get(userId);
            if (existing) {
              const updated = { ...existing, ...data };
              mockSettings.set(userId, updated as typeof existing);
              return [updated];
            }
            return [];
          },
        }),
      }),
    }),
    delete: (_table: unknown) => ({
      where: (_condition: unknown) => Promise.resolve(),
    }),
  },
}));

// Mock argon2
vi.mock("@node-rs/argon2", () => ({
  default: {
    hash: vi.fn(async (password: string) => `hashed_${password}`),
    verify: vi.fn(async (hash: string, password: string) => hash === `hashed_${password}`),
  },
}));

// Mock session module
vi.mock("./session.js", async () => {
  const actual = await vi.importActual<typeof import("./session.js")>("./session.js");
  return {
    ...actual,
    generateSessionToken: () => "test-session-id.test-secret",
    createSession: vi.fn(async (_token: string, userId: string) => {
      const session = {
        id: "test-session-id",
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      mockSessions.set(session.id, {
        id: session.id,
        secretHash: "hashed-secret",
        userId: session.userId,
        expiresAt: session.expiresAt,
      });
      return session;
    }),
    setSessionTokenCookie: vi.fn(),
    deleteSessionTokenCookie: vi.fn(),
    invalidateSession: vi.fn(async (id: string) => {
      mockSessions.delete(id);
    }),
  };
});

// We need to mock the middleware to work with our mock session
vi.mock("./middleware.js", async () => {
  return {
    authMiddleware: async (c: { req: { header: (name: string) => string | undefined }; json: (body: unknown, status?: number) => unknown; set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      // Parse cookie header manually
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
      const user = mockUsers.get(session.userId);
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      c.set("user", { id: user.id, email: user.email, createdAt: user.createdAt });
      await next();
    },
  };
});

// Now import routes after mocks are set up
const { default: auth } = await import("./auth.js");

const app = new Hono();
app.route("/api/auth", auth);

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    mockUsers.clear();
    mockSessions.clear();
    mockSettings.clear();
  });

  it("returns 201 with valid input", async () => {
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", password: "password123" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe("test@example.com");
  });

  it("returns 400 with invalid email", async () => {
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "password123" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("returns 400 with short password", async () => {
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", password: "short" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    mockUsers.clear();
    mockSessions.clear();
  });

  it("returns 401 with wrong password", async () => {
    // Seed a user
    mockUsers.set("user-1", {
      id: "user-1",
      email: "test@example.com",
      passwordHash: "hashed_correct-password",
      createdAt: new Date(),
    });

    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", password: "wrong-password" }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid email or password");
  });

  it("returns 401 with nonexistent email", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: "password123" }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid email or password");
  });

  it("returns 400 with invalid input", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bad", password: "" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/logout", () => {
  it("returns 200", async () => {
    const res = await app.request("/api/auth/logout", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without session", async () => {
    const res = await app.request("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
