import { Hono } from "hono";
import { eq } from "drizzle-orm";
import argon2 from "@node-rs/argon2";
import { signupSchema, loginSchema } from "@openchat/shared";
import { db } from "./db.js";
import { users, userSettings } from "../../../drizzle/schema.js";
import { authMiddleware, type Env } from "./middleware.js";
import {
  generateSessionToken,
  createSession,
  setSessionTokenCookie,
  invalidateSession,
  deleteSessionTokenCookie,
} from "./session.js";
import { getCookie } from "hono/cookie";

const auth = new Hono<Env>();

auth.post("/signup", async (c) => {
  const body = await c.req.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const { email, password } = parsed.data;

  try {
    const passwordHash = await argon2.hash(password);

    const [user] = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning();

    await db.insert(userSettings).values({ userId: user.id });

    const token = generateSessionToken();
    await createSession(token, user.id);
    setSessionTokenCookie(token, c);

    return c.json({ user: { id: user.id, email: user.email } }, 201);
  } catch (err) {
    // Postgres unique violation on email
    if (err && typeof err === "object" && "code" in err && err.code === "23505") {
      return c.json({ error: "Email already registered" }, 409);
    }
    throw err;
  }
});

auth.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const token = generateSessionToken();
  await createSession(token, user.id);
  setSessionTokenCookie(token, c);

  return c.json({ user: { id: user.id, email: user.email } });
});

auth.post("/logout", async (c) => {
  const token = getCookie(c, "session_token");
  if (token) {
    const [sessionId] = token.split(".");
    if (sessionId) {
      await invalidateSession(sessionId);
    }
  }
  deleteSessionTokenCookie(c);
  return c.json({ ok: true });
});

auth.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  return c.json({ user });
});

export default auth;
