import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { attachments } from "../../../drizzle/schema.js";
import { authMiddleware, type Env } from "./middleware.js";
import { uploadFile } from "./storage.js";
import { extractText } from "./extraction.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

const ALLOWED_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
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

app.post("/", async (c) => {
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
  }> = [];

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return c.json(
        {
          error: `File "${file.name}" exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
        },
        400,
      );
    }

    if (!ALLOWED_MIMES.has(file.type)) {
      return c.json(
        { error: `File type "${file.type}" is not allowed` },
        400,
      );
    }

    const id = randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `attachments/${id}/${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadFile(storageKey, buffer, file.type);
    const extractedText = await extractText(buffer, file.type);

    await db.insert(attachments).values({
      id,
      messageId: null,
      filename: file.name,
      storageKey,
      mime: file.type,
      size: file.size,
      extractedText,
    });

    results.push({ id, filename: file.name, mime: file.type, size: file.size });
  }

  return c.json(results, 201);
});

export default app;
