# Changelog

## [unreleased]

### Fix — declutter the chat transcript (grouped tool calls, no dead tools)
- Consecutive tool calls now collapse into one compact, expandable row
  (`ToolCallGroup`, e.g. "Searched the web · 6×") instead of stacking a card per
  call, and empty assistant bubbles from tool-only turns are no longer rendered —
  a looping agent no longer fills the page with chips. (`ChatView`, replaces the
  old per-call `ToolCallDisplay`.)
- `run_code` is only registered when it can actually run (config enabled and
  `dockerode` importable); otherwise the model isn't offered a tool that always
  errors, so the transcript stops filling with failed "Executed code" rows.
  `registerAllTools` is now async; `isCodeExecutionAvailable()` added.

### Fix — tool loop no longer dead-ends at the iteration cap
- The orchestrator rebuilt the provider transcript from only the latest turn each
  iteration, so the model forgot it had already searched and looped redundantly
  until hitting the cap, which then surfaced a bare "Tool call limit reached
  (10 iterations)" error with no answer. Now the transcript accumulates across
  iterations (proper agentic loop), the final iteration withholds tools and
  explicitly instructs the model to answer in prose from what it gathered, and
  the terminal error path is replaced with a graceful finalize. Verified live: a
  web-search prompt now returns a clean, cited answer instead of leaking tool
  syntax or erroring (search count also dropped as the model stops repeating).

### Performance + UX polish (claude.ai-parity pass)
- **Streaming performance**: coalesce SSE token deltas into one state update per animation frame (`createStreamFlusher` in `stores/chat.ts`), and memoize `MessageBubble` + `MarkdownRenderer` so finalized messages no longer re-render/re-parse markdown on every token. Citations and per-message artifacts are precomputed in `ChatView` for stable props. The three near-identical stream loops (send/edit/regenerate) now share one `consumeStream` helper.
- **Code splitting**: route pages, `AppShell`, the artifact panel, and the mermaid/sandbox renderers are `React.lazy`; `vite.config.ts` `manualChunks` splits react / markdown / katex / highlight.js / mermaid vendors. Initial entry chunk dropped ~894 kB → ~6 kB (mermaid, markdown, highlight now load on demand).
- **Virtualized conversation list** via `@tanstack/react-virtual` (spec K, A2).
- **Design consistency**: migrated all remaining cool `gray-*`/`blue-*`/`indigo-*` classes to the warm `stone-*` / `brand-*` design tokens across every component and page (composer, message actions, artifact panel/renderers, tool calls, params, auth + settings + projects + memory pages).
- **Responsive / mobile**: sidebar becomes an off-canvas drawer with a hamburger top bar below `md`; artifact panel renders full-screen overlay on mobile.
- **Command palette** (`Cmd/Ctrl+K`): jump between conversations and run actions (new chat `Cmd/Ctrl+Shift+O`, navigate, toggle theme).
- **Accessibility**: visible focus-visible ring, `prefers-reduced-motion` support, conversation-row actions are real buttons with ARIA labels (no more nested-button markup), and a "jump to latest" affordance in the chat view.
- Tests: command palette open/filter/close (3).

### Phase 9 — Sharing, Export, Connectors, Polish
- Export conversation as Markdown: `GET /api/conversations/:id/export/markdown` returns the active branch as a `.md` file download.
- Export button in ChatView header bar.

### Phase 8 — Memory + Personalization
- `memory_items` table with pgvector embeddings for durable user facts.
- `conv_chunks` table for conversation search via `search_conversations` tool.
- `incognito` flag on conversations to skip memory extraction.
- Memory extraction: after each generation, facts are extracted via LLM and embedded (in-process, fire-and-forget; BullMQ deferred).
- Memory retrieval: relevant facts injected into system prompt via cosine similarity search.
- Memory management API (`/api/memory`) with CRUD and bulk delete.
- Memory management UI: list, edit, delete items; global memory toggle.
- `search_conversations` tool: semantic search over past conversation chunks.
- User preferences: `responseStyle` setting (concise/balanced/detailed/formal).
- Settings page with custom instructions, memory toggle, and response style.

### Phase 7 — Projects + Knowledge
- `projects`, `project_files`, `doc_chunks` (pgvector `vector(1536)`) tables; `projectId` FK on `conversations`.
- Projects CRUD API (`/api/projects`) with ownership enforcement.
- Project file upload with text extraction, chunking (1000-char/200-overlap), and OpenAI embedding (`text-embedding-3-small`).
- RAG retrieval via pgvector cosine similarity; top-5 chunks injected into system prompt with `[Source: filename]` citations.
- Project custom instructions prepended to system prompt for project-scoped conversations.
- Frontend: Projects list page, Project detail page (settings + knowledge file management), sidebar navigation.
- Conversations store extended with `projectId` support; "New Chat" button in project detail creates project-scoped conversations.
- Tests: chunkText (3), buildSystemPrompt project params (2).

### Phase 6 — Tools
