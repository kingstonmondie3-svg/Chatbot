import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

/**
 * Pluggable object storage. Two backends:
 *   - "local": writes under LOCAL_STORAGE_DIR (default <cwd>/.data/storage).
 *     Zero dependencies — uploads work without running MinIO/Docker.
 *   - "s3": S3-compatible (MinIO in dev, real S3 in prod).
 *
 * Driver selection: STORAGE_DRIVER ("local" | "s3"). When unset we default to
 * "local" so a fresh checkout can attach files immediately; set
 * STORAGE_DRIVER=s3 (with the S3_* vars) for a MinIO/S3 setup.
 */
interface StorageBackend {
  upload(key: string, body: Buffer, mime: string): Promise<void>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

// --- Local filesystem backend -------------------------------------------

class LocalStorageBackend implements StorageBackend {
  private baseDir: string;
  private announced = false;

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir);
  }

  /** Resolve a storage key to an absolute path, refusing path traversal. */
  private resolve(key: string): string {
    const full = path.resolve(this.baseDir, key);
    if (full !== this.baseDir && !full.startsWith(this.baseDir + path.sep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return full;
  }

  private announce(): void {
    if (!this.announced) {
      this.announced = true;
      console.log(`[storage] using local disk backend at ${this.baseDir}`);
    }
  }

  async upload(key: string, body: Buffer): Promise<void> {
    this.announce();
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
  }

  async download(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch (err) {
      // A missing file is fine for a delete; rethrow anything else.
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
}

// --- S3 backend ----------------------------------------------------------

class S3StorageBackend implements StorageBackend {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? "",
        secretAccessKey: process.env.S3_SECRET_KEY ?? "",
      },
      forcePathStyle: true,
    });
    this.bucket = process.env.S3_BUCKET ?? "openchat";
  }

  async upload(key: string, body: Buffer, mime: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: mime }),
    );
  }

  async download(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const chunks: Uint8Array[] = [];
    // Body is a Readable stream in Node.js
    const body = res.Body as unknown as NodeJS.ReadableStream;
    for await (const chunk of body) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

// --- Backend selection ---------------------------------------------------

let _backend: StorageBackend | null = null;

function getBackend(): StorageBackend {
  if (!_backend) {
    const driver = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
    if (driver === "s3") {
      _backend = new S3StorageBackend();
    } else {
      const dir =
        process.env.LOCAL_STORAGE_DIR ?? path.join(process.cwd(), ".data", "storage");
      _backend = new LocalStorageBackend(dir);
    }
  }
  return _backend;
}

export function uploadFile(key: string, body: Buffer, mime: string): Promise<void> {
  return getBackend().upload(key, body, mime);
}

export function downloadFile(key: string): Promise<Buffer> {
  return getBackend().download(key);
}

export function deleteFile(key: string): Promise<void> {
  return getBackend().delete(key);
}

// Reset cached backend (used by tests / after env changes).
export function _resetClient(): void {
  _backend = null;
}
