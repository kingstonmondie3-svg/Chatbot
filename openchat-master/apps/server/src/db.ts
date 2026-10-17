import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../../drizzle/schema.js";

const url =
  process.env.DATABASE_URL ??
  "postgresql://openchat:openchat@localhost:5432/openchat";

const client = postgres(url);
export const db = drizzle(client, { schema });
