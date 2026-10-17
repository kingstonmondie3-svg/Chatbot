# Phase 1 — Auth + shell (copy-paste prompt)

Read `CLAUDE.md` and `docs/01-feature-spec.md` (sections I1, J1). Plan first.

Goal: users can sign in and see an empty app shell.

Deliverables:
1. Drizzle schema: `users`, `sessions`, `user_settings`.
2. Lucia auth: signup, login, logout, session middleware (feature I1).
   Password hashing, email format validation via Zod.
3. Server routes: `/api/auth/signup`, `/login`, `/logout`, `/me`.
4. Client: login + signup pages, auth state via Zustand, protected
   routes that redirect unauthenticated users to login.
5. App shell: a sidebar region + main panel region (empty for now),
   light/dark/system theme toggle persisted in `user_settings`.
6. Tests for auth route logic.

Acceptance: register a user, log in, see the shell; refresh keeps the
session; logout returns to login. Then run `/ship`.

---

# Phase 2 — Conversation MVP (copy-paste prompt)

Read `CLAUDE.md`, `docs/01-feature-spec.md` (A1, A2, A4, B1), and
`docs/02-architecture.md` (orchestrator, ModelProvider, SSE). Plan first.

Goal: core chat works end to end with one provider.

Deliverables:
1. Drizzle schema: `conversations`, `messages` (flat parent_id nullable
   for now), `attachments` table stub.
2. `packages/providers`: implement the OpenAI adapter using the
   `add-model-provider` skill. Provider key from env.
3. Generation orchestrator in `apps/server` per `docs/02-architecture.md`:
   build prompt, call adapter, stream `GenerationEvent`s.
4. `POST /api/conversations/:id/messages` returning an SSE stream.
   Implement clean stop via `AbortController`.
5. Conversation CRUD routes: create, list, get, delete.
6. Client: conversation list in the sidebar; chat view with multi-line
   input (Enter send, Shift+Enter newline); streaming assistant bubble;
   stop button; inline error + retry.
7. Markdown rendering with react-markdown; Shiki code blocks with copy
   button; KaTeX math (feature A4).
8. Unit tests for the orchestrator (mock provider) and SSE parsing.

Acceptance: send a message, watch tokens stream in, stop mid-stream,
see the conversation persist in the list and reload correctly.
Then run `/ship`.
