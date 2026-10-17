import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { projects, projectFiles, docChunks } from "../../../drizzle/schema.js";
import { authMiddleware, type Env } from "./middleware.js";
import { uploadFile } from "./storage.js";
import { extractText } from "./extraction.js";
import { chunkText, embedBatch } from "./embeddings.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "text/x-python",
  "text/javascript",
  "text/typescript",
  "text/html",
  "text/css",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const app = new Hono<Env>();

app.use("/*", authMiddleware);

// POST /:projectId/files — upload knowledge files
app.post("/:projectId/files", async (c) => {
  const user = c.get("user");
  const projectId = c.req.param("projectId");

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .limit(1);

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const formData = await c.req.formData();
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return c.json({ error: "No files provided" }, 400);
  }

  if (files.length > MAX_FILES) {
    return c.json({ error: `Maximum ${MAX_FILES} files allowed` }, 400);
  }

  const results: Array<{
    id: string;
    filename: string;
    mime: string;
    size: number;
    status: string;
  }> = [];

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return c.json(
        { error: `File "${file.name}" exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        400,
      );
    }

    if (!ALLOWED_MIMES.has(file.type)) {
      return c.json({ error: `File type "${file.type}" is not allowed` }, 400);
    }

    const id = randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `projects/${projectId}/${id}/${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadFile(storageKey, buffer, file.type);
    const extractedText = await extractText(buffer, file.type);

    await db.insert(projectFiles).values({
      id,
      projectId,
      filename: file.name,
      storageKey,
      mime: file.type,
      size: file.size,
      extractedText,
      status: "processing",
      chunkCount: 0,
    });

    results.push({
      id,
      filename: file.name,
      mime: file.type,
      size: file.size,
      status: "processing",
    });

    // Process chunking and embedding in background (don't await)
    processFileEmbeddings(id, projectId, extractedText).catch((err) => {
      console.error(`Failed to process embeddings for file ${id}:`, err);
    });
  }

  return c.json(results, 201);
});

// GET /:projectId/files — list project files
app.get("/:projectId/files", async (c) => {
  const user = c.get("user");
  const projectId = c.req.param("projectId");

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .limit(1);

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const rows = await db
    .select()
    .from(projectFiles)
    .where(eq(projectFiles.projectId, projectId))
    .orderBy(projectFiles.createdAt);

  return c.json(rows);
});

// DELETE /:projectId/files/:fileId — delete a project file
app.delete("/:projectId/files/:fileId", async (c) => {
  const user = c.get("user");
  const projectId = c.req.param("projectId");
  const fileId = c.req.param("fileId");

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .limit(1);

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const [file] = await db
    .delete(projectFiles)
    .where(and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, projectId)))
    .returning();

  if (!file) {
    return c.json({ error: "File not found" }, 404);
  }

  return c.json({ ok: true });
});

// GET /:projectId/search — RAG retrieval: search project chunks by similarity
app.get("/:projectId/search", async (c) => {
  const user = c.get("user");
  const projectId = c.req.param("projectId");
  const q = c.req.query("q");

  if (!q || q.trim().length === 0) {
    return c.json({ error: "Query parameter 'q' is required" }, 400);
  }

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .limit(1);

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  try {
    const results = await retrieveContext(projectId, q);
    return c.json(results);
  } catch (err) {
    return c.json({ error: `RAG search failed: ${String(err)}` }, 500);
  }
});

/** Background task: chunk file text and embed into doc_chunks. */
async function processFileEmbeddings(
  fileId: string,
  projectId: string,
  extractedText: string | null,
): Promise<void> {
  try {
    if (!extractedText) {
      await db
        .update(projectFiles)
        .set({ status: "ready", chunkCount: 0 })
        .where(eq(projectFiles.id, fileId));
      return;
    }

    const chunks = chunkText(extractedText);
    const embeddings = await embedBatch(chunks);

    const rows = chunks.map((content, i) => ({
      id: randomUUID(),
      fileId,
      projectId,
      chunkIndex: i,
      content,
      embedding: embeddings[i],
    }));

    // Insert in batches of 100
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      await db.insert(docChunks).values(batch);
    }

    await db
      .update(projectFiles)
      .set({ status: "ready", chunkCount: chunks.length })
      .where(eq(projectFiles.id, fileId));
  } catch (err) {
    console.error(`Embedding processing failed for file ${fileId}:`, err);
    await db
      .update(projectFiles)
      .set({ status: "error" })
      .where(eq(projectFiles.id, fileId));
  }
}

/** RAG retrieval: find relevant chunks for a query within a project. */
export async function retrieveContext(
  projectId: string,
  query: string,
  limit = 5,
): Promise<Array<{ content: string; filename: string; similarity: number }>> {
  try {
    const { embedText } = await import("./embeddings.js");
    const queryEmbedding = await embedText(query);

    const results = await db.execute(sql`
      SELECT
        dc.content,
        pf.filename,
        1 - (dc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) AS similarity
      FROM doc_chunks dc
      JOIN project_files pf ON pf.id = dc.file_id
      WHERE dc.project_id = ${projectId}
      ORDER BY dc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${limit}
    `);

    return results as unknown as Array<{ content: string; filename: string; similarity: number }>;
  } catch (err) {
    console.error("RAG retrieval failed:", err);
    return [];
  }
}

export default app;
