# Phase 0 — Scaffold (copy-paste prompt)

Paste this into Claude Code to start the build.

---

You are setting up Phase 0 of OpenChat. Read `CLAUDE.md`,
`docs/03-tech-stack.md`, and `docs/04-build-roadmap.md` first.

First, give me a plan — do not write code until I approve it.

Goal of Phase 0: an empty but running monorepo.

Deliverables:
1. A pnpm workspace with: `apps/web`, `apps/server`, `packages/shared`,
   `packages/providers`. Root `package.json` with workspace scripts:
   `dev`, `build`, `typecheck`, `test`, `lint`, `db:push`, `db:studio`.
2. `apps/web`: Vite + React 18 + TypeScript + Tailwind. One page that
   fetches `/api/health` and shows the result.
3. `apps/server`: Hono server with a `GET /api/health` route returning
   `{ ok: true }`. Runs on a configurable port.
4. `packages/shared`: TypeScript package; export a placeholder `ModelInfo`
   type to prove cross-package imports work.
5. `packages/providers`: TypeScript package; export the `ModelProvider`
   interface from `docs/02-architecture.md`.
6. `docker-compose.yml`: PostgreSQL 16 (with pgvector), Redis, MinIO.
7. Drizzle configured against the Postgres container; an empty schema
   file; `pnpm db:push` succeeds.
8. ESLint + Prettier (shared config), Vitest set up with one trivial
   passing test per package, a GitHub Actions CI workflow running
   `typecheck`, `lint`, `test`.
9. `.env.example` with every needed variable name (placeholders only),
   and `.gitignore` covering `.env`, `node_modules`, build output,
   `CLAUDE.local.md`, `.claude/settings.local.json`.
10. `docs/CHANGELOG.md` with the first entry.

Acceptance: `pnpm dev` runs web + server together; opening the web app
shows the health-check result; `pnpm typecheck && pnpm test` pass; CI is
green.

When done, follow the `/ship` routine.
