# 03 — Tech Stack

Each choice favors: small surface, good TypeScript support, no lock-in, and
ease of being built incrementally by Claude Code.

## Frontend

| Concern | Choice | Why |
|--------|--------|-----|
| Framework | React 18 + TypeScript | Largest ecosystem; Claude Code handles it well |
| Build | Vite | Fast, simple, SPA-friendly |
| Styling | Tailwind CSS | Utility-first; no bespoke CSS to maintain |
| Primitives | Radix UI | Accessible unstyled components — menus, dialogs |
| Client state | Zustand | Minimal; no boilerplate |
| Server cache | TanStack Query | Caching, retries, optimistic updates |
| Markdown | react-markdown + remark/rehype | Safe, extensible rendering |
| Code highlight | Shiki | Accurate highlighting |
| Math | KaTeX | Fast math rendering |
| Routing | React Router | Standard SPA routing |

## Backend

| Concern | Choice | Why |
|--------|--------|-----|
| Runtime | Node.js 20+ | Ubiquitous |
| HTTP | Hono | Tiny, fast, great TS types, easy SSE |
| Validation | Zod | Shared schemas client + server |
| ORM | Drizzle | Type-safe, SQL-first, simple migrations |
| Database | PostgreSQL 16 | Reliable; pgvector for embeddings |
| Vectors | pgvector | One database, no extra infra |
| Auth | Lucia | Lightweight session auth, no vendor |
| Storage | S3 API (MinIO local) | Standard; swap for any S3 host |
| Queue | BullMQ + Redis | Async indexing, memory extraction |

## Tooling

| Concern | Choice |
|--------|--------|
| Monorepo | pnpm workspaces |
| Lint/format | ESLint + Prettier |
| Tests | Vitest (unit) + Playwright (e2e) |
| CI | GitHub Actions |
| Containers | Docker Compose for local Postgres/Redis/MinIO |

## Model providers (adapters)

Provider SDKs live only in `packages/providers`, one file per provider:
`openai.ts`, `gemini.ts`, `anthropic.ts`, `ollama.ts`. Each implements the
`ModelProvider` interface from `packages/shared`. Adding a provider never
touches the orchestrator or the UI.

## Things deliberately avoided

- No Next.js — a plain SPA + API keeps the streaming + SSE story simple
  and the deployment story flexible. (Swap in Next later if desired.)
- No GraphQL — REST + SSE is enough and easier to reason about.
- No heavy component library — Radix + Tailwind keeps the UI original
  and dependency-light.
