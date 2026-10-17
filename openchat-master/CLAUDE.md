# CLAUDE.md

This file is read by Claude Code at the start of every session. Keep it
accurate and concise. Update it whenever architecture or conventions change.

## What this project is

OpenChat — an open-source AI chat assistant with feature parity to modern
assistant products. Provider-agnostic model layer, original branding only.

## Tech stack (see docs/03-tech-stack.md for rationale)

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Radix UI primitives
- **State**: Zustand (client), TanStack Query (server cache)
- **Backend**: Node.js + Hono (HTTP) + Server-Sent Events for streaming
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Lucia (session-based) or Auth.js
- **File storage**: S3-compatible (MinIO for local dev)
- **Vector store**: pgvector extension (memory + RAG)
- **Model providers**: adapter pattern — OpenAI, Gemini, Anthropic, Ollama

## Repository layout

```
/apps
  /web        React SPA
  /server     Hono API server
/packages
  /shared     Types shared across web + server
  /providers  Model provider adapters (one file each)
/docs         Specs and roadmap
/.claude
  /skills     Repo-specific Claude Code skills
```

## Conventions — follow these strictly

- TypeScript strict mode. No `any` without a `// reason:` comment.
- All API responses validated with Zod schemas in `packages/shared`.
- Streaming responses use SSE, never WebSockets, unless documented otherwise.
- Database access only through Drizzle — no raw SQL except in migrations.
- Every feature ships with: types -> API route -> client hook -> UI.
- Secrets only via `.env`. Never commit keys. `.env.example` stays current.
- Provider adapters must implement the `ModelProvider` interface exactly;
  the rest of the app never imports a provider SDK directly.

## Critical rules

- Do NOT copy code, CSS, markup, or assets from any commercial product.
  All UI is original. This is non-negotiable for legal reasons.
- Do NOT add a model provider SDK import outside `/packages/providers`.
- When unsure about scope, check `docs/01-feature-spec.md` before coding.
- Run `pnpm typecheck && pnpm test` before declaring a task done.

## Design language

Refined, editorial-warm minimalism (calm, generous whitespace, soft surfaces).
Original implementation only — never copy another product's CSS/markup/assets.

- **Type**: body/UI `Hanken Grotesk` (`font-sans`); display/brand & large
  headings `Fraunces` (`font-serif`). Loaded via Google Fonts in `index.html`.
- **Accent**: blue — use the `brand` color scale (Tailwind config), e.g.
  `brand-600` for primary actions, `brand-50` / `brand-500/15` for active tints.
- **Neutrals**: warm `stone-*` (not cool `gray-*`). Light app bg `stone-50`,
  dark bg `#0e0f13`; borders `stone-200/80` light, `white/10` dark.
- **Shape & depth**: rounded-xl/2xl, soft shadows (`shadow-soft`,
  `shadow-composer`), 1px hairline borders — avoid hard high-contrast lines.
- **Surfaces**: chat is a centered `max-w-3xl` reading column; assistant text
  flows full-width (`.oc-prose`), user messages are a subtle right-aligned card.
- **Motion**: subtle only — message fade-up (`.oc-msg-enter`), blinking caret
  (`.oc-caret`), 150ms color transitions. No janky per-token smooth-scroll.

## Current phase

Phase 9 — Sharing, export, connectors, polish. See `docs/04-build-roadmap.md`.
Update this line as phases complete.

## Useful commands

- `pnpm dev` — run web + server together
- `pnpm db:push` — apply schema to local Postgres
- `pnpm db:studio` — open Drizzle Studio
- `pnpm test` — run unit tests
- `pnpm typecheck` — type-check all packages
