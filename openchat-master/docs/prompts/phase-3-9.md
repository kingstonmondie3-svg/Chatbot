# Phases 3-9 — Copy-paste prompts

Each prompt: read `CLAUDE.md` and the cited spec sections, plan first,
build, then run `/ship`. Use the `add-feature` and `db-migration` skills.

---

## Phase 3 — Conversation depth
Spec: A2, A3, A5, B1, B2, B3, B4.

Deliverables:
1. Migrate `messages` to a real tree: `parent_id` drives branches.
   "Active path" computed by walking leaf-to-root.
2. Edit a user message -> forks a new branch (A3, A5).
3. Regenerate -> sibling assistant variants; UI variant switcher "2/3".
4. Auto-generate conversation titles after the first exchange.
5. Conversation rename, pin, and full-text search over titles + messages.
6. Add the Gemini and Anthropic adapters (add-model-provider skill).
7. Model picker UI (context window + cost tier); per-conversation model.
8. Generation params panel (temperature, max tokens, system prompt),
   persisted per conversation. Token usage + optional cost display.

Acceptance: branching, variant switching, search, model switching, and
param changes all work.

---

## Phase 4 — Files
Spec: D1, D2.

Deliverables:
1. File upload service -> S3/MinIO storage; `attachments` populated.
2. Drag-and-drop and clipboard paste in the composer. Size limits.
3. Server-side extraction: PDF and docx text, CSV parsing. Store
   `extracted_text`.
4. Images passed to vision-capable models as image parts.
5. Large files chunked or summarized before being sent to the model.

Acceptance: attach a PDF and an image, ask about both, get a grounded reply.

---

## Phase 5 — Artifacts
Spec: E1, E2, E3.

Deliverables:
1. Detect substantial generated content; open it in a side panel.
2. `artifacts` + `artifact_versions` tables; each edit = new version.
3. Renderers: Markdown, code, SVG, Mermaid; HTML and React inside a
   sandboxed iframe (locked CSP, no parent access).
4. Version navigation, diff view, edit-in-place, download, copy.

Acceptance: ask for an HTML page, see it render sandboxed, request a
change, see version 2 with a diff.

---

## Phase 6 — Tools
Spec: F1, F2, F3.

Deliverables:
1. `Tool` interface + tool runtime; tool loop in the orchestrator,
   capped at 10 iterations; tool calls/results shown collapsibly.
2. `web_search` tool with a pluggable search backend; inline citations
   with source links in the reply.
3. `run_code` tool executing in an isolated sandbox container — no host
   FS, no network beyond an allowlist, CPU + wall-clock limits.

Acceptance: a question triggers a web search and a calculation, both
visible and cited.

---

## Phase 7 — Projects + knowledge
Spec: C1, C2.

Deliverables:
1. Projects CRUD; project custom instructions prepended to the system
   prompt; conversations optionally belong to a project.
2. Project file upload -> chunk -> embed (pgvector `doc_chunks`).
3. RAG retrieval: relevant project chunks injected into the prompt for
   conversations in that project; cited in the reply.

Acceptance: a fact that exists only in a project document is correctly
retrieved and cited inside a conversation.

---

## Phase 8 — Memory + personalization
Spec: G1, G2, G3.

Deliverables:
1. Memory extraction: a BullMQ job after each conversation extracts
   durable facts -> `memory_items` with embeddings.
2. Relevance retrieval injects memory into the prompt.
3. Memory management UI: view, edit, delete items; global on/off toggle;
   incognito mode that writes no memory.
4. `search_conversations` tool over `conv_chunks`, scoped to the user.
5. User preferences / custom instructions in settings (G3).

Acceptance: a fact stated in one conversation is recalled in a later
separate conversation, appears in the memory UI, and can be deleted.

---

## Phase 9 — Sharing, export, connectors, polish
Spec: I2, I3, I4, F4, H1, H2, J1, J2, J3, K.

Deliverables:
1. Share links: immutable conversation snapshot, public read-only route,
   revoke.
2. Export a conversation as Markdown, JSON, PDF.
3. MCP-style connector framework: registry, per-connector enable/auth,
   connector tools registered into the tool runtime.
4. Voice: speech-to-text input, optional text-to-speech output.
5. Rate limits and quota tiers with clear limit messaging.
6. Full settings: account, appearance, data controls (export all,
   delete account, clear conversations), model defaults, connectors,
   memory.
7. Non-functional pass: accessibility audit, i18n string extraction,
   structured logging, e2e tests for the Tier 1 flows.

Acceptance: every Tier 1-3 acceptance criterion in
`docs/01-feature-spec.md` passes.
