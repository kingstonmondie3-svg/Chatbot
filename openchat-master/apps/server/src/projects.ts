import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { createProjectSchema, updateProjectSchema } from "@openchat/shared";
import { db } from "./db.js";
import { projects, conversations } from "../../../drizzle/schema.js";
import { authMiddleware, type Env } from "./middleware.js";

const app = new Hono<Env>();

app.use("/*", authMiddleware);

// POST / — create project
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const user = c.get("user");
  const [project] = await db
    .insert(projects)
    .values({
      userId: user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      customInstructions: parsed.data.customInstructions ?? null,
    })
    .returning();

  return c.json(project, 201);
});

// GET / — list projects
app.get("/", async (c) => {
  const user = c.get("user");
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(desc(projects.updatedAt));

  return c.json(rows);
});

// GET /:id — get single project
app.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
    .limit(1);

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json(project);
});

// PATCH /:id — update project
app.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateProjectSchema.safeParse(body);
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

  const [project] = await db
    .update(projects)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
    .returning();

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json(project);
});

// DELETE /:id — delete project
app.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [project] = await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
    .returning();

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json({ ok: true });
});

// GET /:id/conversations — list conversations in a project
app.get("/:id/conversations", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
    .limit(1);

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const rows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.projectId, id), eq(conversations.userId, user.id)))
    .orderBy(desc(conversations.updatedAt));

  return c.json(rows);
});

export default app;
