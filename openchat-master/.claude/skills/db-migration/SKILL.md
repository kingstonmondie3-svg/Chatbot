---
name: db-migration
description: >
  Use when changing the OpenChat database schema — adding tables, columns,
  indexes, or pgvector columns. Covers the safe Drizzle migration flow.
---

# Skill: Database migration

## Steps

1. Edit the schema in `apps/server/src/db/schema.ts`. Match the data model
   in `docs/02-architecture.md`.

2. For embeddings, use a `vector` column (pgvector) and add the matching
   index (e.g. an HNSW or IVFFlat index) for similarity search.

3. Generate the migration:
   `pnpm drizzle-kit generate`

4. Review the generated SQL in `apps/server/drizzle/`. Confirm it is
   non-destructive. If a column is being dropped or a type narrowed,
   stop and flag it — write a data-preserving migration instead.

5. Apply locally: `pnpm db:push` (dev) or run the migration.

6. Update `docs/02-architecture.md` if the data model changed.

7. Verify with `pnpm db:studio`.

## Rules
- Never hand-edit a database outside a migration.
- Additive changes are safe; destructive changes need an explicit
  multi-step plan (add new -> backfill -> switch -> drop old).
- Every new table that holds user data must have a `user_id` and all
  queries against it must filter by the authenticated user.
