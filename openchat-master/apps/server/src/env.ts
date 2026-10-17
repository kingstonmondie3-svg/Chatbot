import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Load the monorepo-root .env regardless of the process cwd (the server is run
// from apps/server in dev and apps/server/dist in prod — both are one level
// below apps/server, so ../../../.env points at the repo root either way).
// Imported first in index.ts so env vars are set before modules like db.ts
// read process.env at import time. Missing .env is a no-op (dotenv won't throw).
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env") });
