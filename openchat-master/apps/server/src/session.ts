import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { sessions, users } from "../../../drizzle/schema.js";
import type { Context } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds
const SESSION_EXTENSION_THRESHOLD = 60 * 60 * 24; // 1 day in seconds

// --- base32 encoding (RFC 4648, 5-bit groups) ---

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

// --- SHA-256 hashing ---

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(hashBuffer).toString("hex");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let c = 0;
  for (let i = 0; i < a.length; i++) {
    c |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return c === 0;
}

// --- session types ---

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}

export type SessionValidationResult =
  | { session: Session; user: { id: string; email: string; createdAt: Date } }
  | { session: null; user: null };

// --- public API ---

export function generateSessionToken(): string {
  const idBytes = generateRandomBytes(20);
  const secretBytes = generateRandomBytes(20);
  return `${encodeBase32(idBytes)}.${encodeBase32(secretBytes)}`;
}

export async function createSession(
  token: string,
  userId: string,
): Promise<Session> {
  const [id, secret] = token.split(".");
  const secretHash = await sha256(secret);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  const [row] = await db
    .insert(sessions)
    .values({ id, secretHash, userId, expiresAt })
    .returning();

  return { id: row.id, userId: row.userId, expiresAt: row.expiresAt };
}

export async function validateSessionToken(
  token: string,
): Promise<SessionValidationResult> {
  const [id, secret] = token.split(".");
  if (!id || !secret) return { session: null, user: null };

  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);

  if (!row) return { session: null, user: null };

  if (row.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return { session: null, user: null };
  }

  const secretHash = await sha256(secret);
  if (!constantTimeEqual(secretHash, row.secretHash)) {
    return { session: null, user: null };
  }

  // sliding window: extend if within threshold
  const timeUntilExpiry = row.expiresAt.getTime() - Date.now();
  if (timeUntilExpiry < SESSION_EXTENSION_THRESHOLD * 1000) {
    const newExpiry = new Date(Date.now() + SESSION_MAX_AGE * 1000);
    await db
      .update(sessions)
      .set({ expiresAt: newExpiry })
      .where(eq(sessions.id, id));
    row.expiresAt = newExpiry;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);

  if (!user) return { session: null, user: null };

  return {
    session: { id: row.id, userId: row.userId, expiresAt: row.expiresAt },
    user: { id: user.id, email: user.email, createdAt: user.createdAt },
  };
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function invalidateAllSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export function setSessionTokenCookie(token: string, c: Context): void {
  setCookie(c, "session_token", token, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

export function deleteSessionTokenCookie(c: Context): void {
  deleteCookie(c, "session_token", {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  });
}
