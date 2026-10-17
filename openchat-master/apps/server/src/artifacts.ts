import { Hono } from "hono";
import { eq, and, asc } from "drizzle-orm";
import { createArtifactVersionSchema } from "@openchat/shared";
import { db } from "./db.js";
import {
  conversations,
  artifacts as artifactsTable,
  artifactVersions,
} from "../../../drizzle/schema.js";
import { authMiddleware, type Env } from "./middleware.js";

const app = new Hono<Env>();

app.use("/*", authMiddleware);

// GET /:conversationId/artifacts — list artifact metadata for a conversation
app.get("/:conversationId/artifacts", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const conversationId = c.req.param("conversationId");

  // Verify conversation ownership
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)))
    .limit(1);

  if (!conv) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  const rows = await db
    .select()
    .from(artifactsTable)
    .where(eq(artifactsTable.conversationId, conversationId))
    .orderBy(asc(artifactsTable.createdAt));

  return c.json(rows);
});

// GET /:conversationId/artifacts/:artifactId — get artifact with all versions
app.get("/:conversationId/artifacts/:artifactId", async (c) => {
  const user = c.get("user");
  const conversationId = c.req.param("conversationId");
  const artifactId = c.req.param("artifactId");

  // Verify conversation ownership
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)))
    .limit(1);

  if (!conv) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  // Get artifact
  const [artifact] = await db
    .select()
    .from(artifactsTable)
    .where(
      and(
        eq(artifactsTable.id, artifactId),
        eq(artifactsTable.conversationId, conversationId),
      ),
    )
    .limit(1);

  if (!artifact) {
    return c.json({ error: "Artifact not found" }, 404);
  }

  // Get all versions
  const versions = await db
    .select()
    .from(artifactVersions)
    .where(eq(artifactVersions.artifactId, artifactId))
    .orderBy(asc(artifactVersions.versionNumber));

  return c.json({ ...artifact, versions });
});

// GET /:conversationId/artifacts/:artifactId/versions/:versionNumber — get single version
app.get("/:conversationId/artifacts/:artifactId/versions/:versionNumber", async (c) => {
  const user = c.get("user");
  const conversationId = c.req.param("conversationId");
  const artifactId = c.req.param("artifactId");
  const versionNumber = parseInt(c.req.param("versionNumber"), 10);

  // Verify conversation ownership
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)))
    .limit(1);

  if (!conv) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  // Verify artifact belongs to conversation
  const [artifact] = await db
    .select()
    .from(artifactsTable)
    .where(
      and(
        eq(artifactsTable.id, artifactId),
        eq(artifactsTable.conversationId, conversationId),
      ),
    )
    .limit(1);

  if (!artifact) {
    return c.json({ error: "Artifact not found" }, 404);
  }

  const [version] = await db
    .select()
    .from(artifactVersions)
    .where(
      and(
        eq(artifactVersions.artifactId, artifactId),
        eq(artifactVersions.versionNumber, versionNumber),
      ),
    )
    .limit(1);

  if (!version) {
    return c.json({ error: "Version not found" }, 404);
  }

  return c.json(version);
});

// POST /:conversationId/artifacts/:artifactId/versions — add a new version
app.post("/:conversationId/artifacts/:artifactId/versions", async (c) => {
  const user = c.get("user");
  const conversationId = c.req.param("conversationId");
  const artifactId = c.req.param("artifactId");
  const body = await c.req.json();
  const parsed = createArtifactVersionSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  // Verify conversation ownership
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)))
    .limit(1);

  if (!conv) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  // Verify artifact belongs to conversation
  const [artifact] = await db
    .select()
    .from(artifactsTable)
    .where(
      and(
        eq(artifactsTable.id, artifactId),
        eq(artifactsTable.conversationId, conversationId),
      ),
    )
    .limit(1);

  if (!artifact) {
    return c.json({ error: "Artifact not found" }, 404);
  }

  const newVersionNumber = artifact.currentVersion + 1;

  // Insert new version
  const [version] = await db
    .insert(artifactVersions)
    .values({
      artifactId,
      versionNumber: newVersionNumber,
      content: parsed.data.content,
    })
    .returning();

  // Update current version on artifact
  await db
    .update(artifactsTable)
    .set({ currentVersion: newVersionNumber })
    .where(eq(artifactsTable.id, artifactId));

  return c.json(version, 201);
});

export default app;
