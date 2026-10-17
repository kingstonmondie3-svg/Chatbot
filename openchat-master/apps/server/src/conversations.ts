import { Hono } from "hono";
import { eq, and, desc, ilike, inArray } from "drizzle-orm";
import { streamSSE } from "hono/streaming";
import {
  createConversationSchema,
  updateConversationSchema,
  sendMessageSchema,
  editMessageSchema,
} from "@openchat/shared";
import { db } from "./db.js";
import { conversations, messages, attachments, projects } from "../../../drizzle/schema.js";
import { authMiddleware, type Env } from "./middleware.js";
import { generate, regenerate, loadActivePath } from "./orchestrator.js";
import { formatConversationMarkdown } from "./export.js";

const app = new Hono<Env>();

app.use("/*", authMiddleware);

// POST / — create conversation
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createConversationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const user = c.get("user");

  // Validate projectId if provided
  if (parsed.data.projectId) {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, parsed.data.projectId), eq(projects.userId, user.id)))
      .limit(1);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }
  }

  const [conv] = await db
    .insert(conversations)
    .values({
      userId: user.id,
      model: parsed.data.model ?? "nvidia/nemotron-3.5-lightning:free",
      params: parsed.data.params ?? {},
      title: parsed.data.title ?? null,
      projectId: parsed.data.projectId ?? null,
      incognito: parsed.data.incognito ?? false,
    })
    .returning();

  return c.json(conv, 201);
});

// GET / — list conversations
app.get("/", async (c) => {
  const user = c.get("user");
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, user.id))
    .orderBy(desc(conversations.updatedAt))
    .limit(50);

  return c.json(rows);
});

// GET /search — search conversations by title and message content
app.get("/search", async (c) => {
  const user = c.get("user");
  const q = c.req.query("q");
  if (!q || q.trim().length === 0) {
    return c.json({ error: "Query parameter 'q' is required" }, 400);
  }

  const pattern = `%${q}%`;

  // Search by title (ILIKE partial match)
  const byTitle = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, user.id), ilike(conversations.title, pattern)))
    .orderBy(desc(conversations.updatedAt))
    .limit(20);

  // Search by message content (join, ILIKE partial match)
  const byMessage = await db
    .selectDistinct()
    .from(conversations)
    .innerJoin(messages, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.userId, user.id),
        ilike(messages.content, pattern),
      ),
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(20)
    .then((rows) => rows.map((r) => r.conversations));

  // Deduplicate and merge
  const seen = new Set<string>();
  const results = [];
  for (const conv of [...byTitle, ...byMessage]) {
    if (!seen.has(conv.id)) {
      seen.add(conv.id);
      results.push(conv);
    }
  }

  return c.json(results.slice(0, 20));
});

// GET /:id — get single conversation
app.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
    .limit(1);

  if (!conv) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  return c.json(conv);
});

// PATCH /:id — update conversation
app.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateConversationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  const [conv] = await db
    .update(conversations)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
    .returning();

  if (!conv) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  return c.json(conv);
});

// DELETE /:id — delete conversation
app.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [conv] = await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
    .returning();

  if (!conv) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  return c.json({ ok: true });
});

// GET /:id/messages — list messages
app.get("/:id/messages", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  // Verify ownership
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
    .limit(1);

  if (!conv) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);

  // Batch-fetch attachments for all messages
  const messageIds = rows.map((r) => r.id);
  const attachRows =
    messageIds.length > 0
      ? await db
          .select()
          .from(attachments)
          .where(inArray(attachments.messageId, messageIds))
      : [];
  const attachmentsByMessage = new Map<
    string,
    Array<{ id: string; filename: string; mime: string; size: number }>
  >();
  for (const a of attachRows) {
    if (!a.messageId) continue;
    const list = attachmentsByMessage.get(a.messageId) ?? [];
    list.push({ id: a.id, filename: a.filename, mime: a.mime, size: a.size });
    attachmentsByMessage.set(a.messageId, list);
  }

  const messagesWithAttachments = rows.map((m) => ({
    ...m,
    attachments: attachmentsByMessage.get(m.id) ?? [],
  }));

  return c.json({ messages: messagesWithAttachments, activeLeafId: conv.activeLeafId });
});

// GET /:id/export/markdown — export active branch as Markdown file
app.get("/:id/export/markdown", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
    .limit(1);

  if (!conv) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  const path = await loadActivePath(id, conv.activeLeafId);
  const markdown = formatConversationMarkdown(conv.title, path);

  const filename = conv.title
    ? conv.title.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "-").toLowerCase().slice(0, 100) + ".md"
    : "conversation.md";

  c.header("Content-Type", "text/markdown; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  return c.body(markdown);
});

// POST /:id/messages — send message and stream response
app.post("/:id/messages", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  // Verify ownership
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
    .limit(1);

  if (!conv) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  const controller = new AbortController();

  return streamSSE(c, async (stream) => {
    stream.onAbort(() => {
      controller.abort();
    });

    try {
      for await (const event of generate(id, parsed.data.content, user.id, controller.signal, parsed.data.parentId, parsed.data.attachmentIds)) {
        if (stream.aborted) break;
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      }
    } catch (err) {
      console.error(`[chat ${id.slice(0, 8)}] generate threw:`, err);
      if (!stream.aborted) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ type: "error", message: String(err) }),
        });
      }
    }
  });
});

// POST /:id/messages/:messageId/edit — edit a user message and fork
app.post("/:id/messages/:messageId/edit", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const messageId = c.req.param("messageId");
  const body = await c.req.json();
  const parsed = editMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  // Verify ownership
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
    .limit(1);

  if (!conv) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  // Verify target message exists, belongs to conversation, and is a user message
  const [target] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.conversationId, id)))
    .limit(1);

  if (!target) {
    return c.json({ error: "Message not found" }, 404);
  }

  if (target.role !== "user") {
    return c.json({ error: "Can only edit user messages" }, 400);
  }

  // The new message's parent is the same as the original message's parent
  // This forks the conversation at this point
  const controller = new AbortController();

  return streamSSE(c, async (stream) => {
    stream.onAbort(() => {
      controller.abort();
    });

    try {
      for await (const event of generate(id, parsed.data.content, user.id, controller.signal, target.parentId)) {
        if (stream.aborted) break;
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      }
    } catch (err) {
      console.error(`[chat ${id.slice(0, 8)}] edit generate threw:`, err);
      if (!stream.aborted) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ type: "error", message: String(err) }),
        });
      }
    }
  });
});

// POST /:id/messages/:messageId/regenerate — regenerate an assistant message
app.post("/:id/messages/:messageId/regenerate", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const messageId = c.req.param("messageId");

  // Verify ownership
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
    .limit(1);

  if (!conv) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  // Verify target message exists and is an assistant message
  const [target] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.conversationId, id)))
    .limit(1);

  if (!target) {
    return c.json({ error: "Message not found" }, 404);
  }

  if (target.role !== "assistant") {
    return c.json({ error: "Can only regenerate assistant messages" }, 400);
  }

  // parentId points to the user message that prompted this assistant message
  const userMessageId = target.parentId;

  if (!userMessageId) {
    return c.json({ error: "Cannot regenerate: no parent user message found" }, 400);
  }

  const controller = new AbortController();

  return streamSSE(c, async (stream) => {
    stream.onAbort(() => {
      controller.abort();
    });

    try {
      for await (const event of regenerate(id, userMessageId, user.id, controller.signal)) {
        if (stream.aborted) break;
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      }
    } catch (err) {
      console.error(`[chat ${id.slice(0, 8)}] regenerate threw:`, err);
      if (!stream.aborted) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ type: "error", message: String(err) }),
        });
      }
    }
  });
});

export default app;
