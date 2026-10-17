import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { updateMemoryItemSchema } from "@openchat/shared";
import { db } from "./db.js";
import { memoryItems } from "../../../drizzle/schema.js";
import { embedText } from "@openchat/providers";
import { authMiddleware, type Env } from "./middleware.js";

const memory = new Hono<Env>();

memory.use("/*", authMiddleware);

// GET / — list all memory items for the authenticated user
memory.get("/", async (c) => {
  const user = c.get("user");

  const rows = await db
    .select()
    .from(memoryItems)
    .where(eq(memoryItems.userId, user.id))
    .orderBy(desc(memoryItems.createdAt));

  return c.json(
    rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      conversationId: r.conversationId,
      content: r.content,
      source: r.source,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  );
});

// GET /:id — get a single memory item
memory.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [row] = await db
    .select()
    .from(memoryItems)
    .where(and(eq(memoryItems.id, id), eq(memoryItems.userId, user.id)))
    .limit(1);

  if (!row) {
    return c.json({ error: "Memory item not found" }, 404);
  }

  return c.json({
    id: row.id,
    userId: row.userId,
    conversationId: row.conversationId,
    content: row.content,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

// PATCH /:id — update a memory item's content (re-embeds)
memory.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateMemoryItemSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  // Verify ownership
  const [existing] = await db
    .select()
    .from(memoryItems)
    .where(and(eq(memoryItems.id, id), eq(memoryItems.userId, user.id)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Memory item not found" }, 404);
  }

  // Re-embed the updated content
  const embedding = await embedText(parsed.data.content);

  const [updated] = await db
    .update(memoryItems)
    .set({ content: parsed.data.content, embedding, updatedAt: new Date() })
    .where(eq(memoryItems.id, id))
    .returning();

  return c.json({
    id: updated.id,
    userId: updated.userId,
    conversationId: updated.conversationId,
    content: updated.content,
    source: updated.source,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

// DELETE /:id — delete a single memory item
memory.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [deleted] = await db
    .delete(memoryItems)
    .where(and(eq(memoryItems.id, id), eq(memoryItems.userId, user.id)))
    .returning();

  if (!deleted) {
    return c.json({ error: "Memory item not found" }, 404);
  }

  return c.json({ ok: true });
});

// DELETE / — delete all memory items for the user (optional conversationId filter)
memory.delete("/", async (c) => {
  const user = c.get("user");
  const conversationId = c.req.query("conversationId");

  if (conversationId) {
    await db
      .delete(memoryItems)
      .where(
        and(eq(memoryItems.userId, user.id), eq(memoryItems.conversationId, conversationId)),
      );
  } else {
    await db.delete(memoryItems).where(eq(memoryItems.userId, user.id));
  }

  return c.json({ ok: true });
});

export default memory;
