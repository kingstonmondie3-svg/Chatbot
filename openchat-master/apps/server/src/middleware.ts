import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import {
  validateSessionToken,
  deleteSessionTokenCookie,
  type Session,
} from "./session.js";

export type Env = {
  Variables: {
    session: Session;
    user: { id: string; email: string; createdAt: Date };
  };
};

export async function authMiddleware(c: Context<Env>, next: Next) {
  const token = getCookie(c, "session_token");
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await validateSessionToken(token);
  if (!result.session) {
    deleteSessionTokenCookie(c);
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("session", result.session);
  c.set("user", result.user);
  await next();
}
