# 04 — Build Roadmap

Build in phases. Each phase ends with something that runs and is tested.
Do not start a phase until the previous one passes `typecheck` and `test`.

Each phase has a matching prompt file in `docs/prompts/`.

---

## Phase 0 — Scaffold
**Goal:** an empty but running monorepo.
- pnpm workspace: `apps/web`, `apps/server`, `packages/shared`, `packages/providers`.
- Vite + React + Tailwind in `web`; Hono in `server`.
- Docker Compose for Postgres + Redis + MinIO.
- Drizzle configured; empty schema; `pnpm db:push` works.
- ESLint, Prettier, Vitest, CI workflow.
- `pnpm dev` serves a "hello" page that fetches `/api/health`.
**Done when:** `pnpm dev` runs, health check passes, CI is green.

## Phase 1 — Auth + shell
**Goal:** users can sign in and see an empty app shell.
- Lucia auth: signup, login, logout, sessions (I1).
- App layout: sidebar + main panel, light/dark theme (J1 partial).
- Protected routes; redirect to login.
**Done when:** a user can register, log in, and see the shell.

## Phase 2 — Conversation MVP
**Goal:** the core chat works with one provider.
- Data model: conversations, messages (flat for now).
- `ModelProvider` interface + the OpenAI adapter (B1 partial).
- Generation orchestrator with SSE streaming (A1).
- Message input, streaming bubble, stop button.
- Markdown + code rendering (A4).
- Conversation list: create, list, open, delete (A2 partial).
**Done when:** send a message, watch it stream, see it in history.

## Phase 3 — Conversation depth
**Goal:** the conversation feature set is complete.
- Message tree + branching (A5); edit-forks; regenerate variants (A3).
- Title auto-generation; rename, pin, search (A2 full).
- Second + third provider adapters; model picker (B1, B2).
- Generation params + token usage display (B3, B4).
**Done when:** branching, variants, search, and model switching all work.

## Phase 4 — Files
**Goal:** users can attach files and the model can read them.
- Upload service + S3 storage; drag-drop + paste (D1).
- Server-side extraction: PDF, docx, csv (D2).
- Images passed to vision models (D2).
**Done when:** attach a PDF and an image, ask about them, get a grounded reply.

## Phase 5 — Artifacts
**Goal:** substantial output opens in a versioned side panel.
- Artifact detection + side panel (E1).
- Sandboxed iframe for HTML/React; Mermaid + SVG rendering (E1, E3).
- Versions, diff view, edit-in-place (E2).
**Done when:** ask for an HTML page, see it render, request a change, see v2.

## Phase 6 — Tools
**Goal:** the model can call tools mid-generation.
- Tool runtime + tool loop in the orchestrator (F1).
- `web_search` tool with inline citations (F2).
- `run_code` tool in a sandboxed container (F3).
**Done when:** a question triggers a web search and a calculation, both cited.

## Phase 7 — Projects + knowledge
**Goal:** workspaces with retrievable knowledge.
- Projects CRUD + custom instructions (C1).
- Project file upload, chunking, embedding, RAG retrieval (C2).
**Done when:** a project doc is correctly cited inside a conversation.

## Phase 8 — Memory + personalization
**Goal:** the app remembers across conversations.
- Memory extraction queue + pgvector storage + retrieval (G1).
- Memory management UI; incognito mode; global toggle (G1).
- `search_conversations` tool (G2).
- User preferences / custom instructions (G3).
**Done when:** a fact stated in one chat is recalled in another, and can be deleted.

## Phase 9 — Sharing, export, connectors, polish
**Goal:** the long tail.
- Share links with immutable snapshots (I2).
- Export Markdown / JSON / PDF (I3).
- MCP-style connector framework (F4).
- Voice in/out (H1, H2).
- Rate limits + quotas (I4); full settings + data controls (J1–J3).
- Accessibility audit, i18n extraction, e2e test pass.
**Done when:** all Tier 1–3 acceptance criteria pass.

---

## Definition of done (every phase)

1. New code is typed; `pnpm typecheck` passes.
2. New logic has unit tests; `pnpm test` passes.
3. `CLAUDE.md` "Current phase" line updated.
4. `.env.example` updated if new config was added.
5. A short note in `docs/CHANGELOG.md` describing what shipped.
