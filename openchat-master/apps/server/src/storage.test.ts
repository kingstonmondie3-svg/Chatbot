import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { uploadFile, downloadFile, deleteFile, _resetClient } from "./storage.js";

const testDir = join(tmpdir(), `openchat-storage-test-${randomUUID()}`);

describe("local storage backend", () => {
  beforeEach(() => {
    process.env.STORAGE_DRIVER = "local";
    process.env.LOCAL_STORAGE_DIR = testDir;
    _resetClient();
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("round-trips an uploaded file", async () => {
    const key = "attachments/abc/hello.txt";
    const body = Buffer.from("hello world", "utf-8");

    await uploadFile(key, body, "text/plain");
    const got = await downloadFile(key);

    expect(got.equals(body)).toBe(true);
  });

  it("creates nested key directories", async () => {
    const key = "projects/p1/f1/deep/nested.bin";
    const body = Buffer.from([1, 2, 3, 4]);

    await uploadFile(key, body, "application/octet-stream");
    expect((await downloadFile(key)).equals(body)).toBe(true);
  });

  it("delete removes the file and is idempotent", async () => {
    const key = "attachments/del/x.txt";
    await uploadFile(key, Buffer.from("x"), "text/plain");

    await deleteFile(key);
    await expect(downloadFile(key)).rejects.toThrow();
    // Deleting a missing key must not throw.
    await expect(deleteFile(key)).resolves.toBeUndefined();
  });

  it("rejects path-traversal keys", async () => {
    await expect(
      uploadFile("../escape.txt", Buffer.from("nope"), "text/plain"),
    ).rejects.toThrow(/Invalid storage key/);
  });
});
