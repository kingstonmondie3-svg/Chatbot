# 01 — Feature Specification

This is the complete feature set. Each feature has an ID, a description, and
acceptance criteria. Claude Code should treat the acceptance criteria as the
definition of "done."

---

## A. Conversation core

### A1 — Send and receive messages
A user types a message; the assistant replies.
- Multi-line input, Shift+Enter for newline, Enter to send.
- Token-by-token streaming display of the reply (SSE).
- Stop-generation button cancels an in-flight stream cleanly.
- Errors surface inline with a retry action.

### A2 — Conversation list
A sidebar lists all conversations, newest first.
- Auto-generated title from the first exchange.
- Rename, delete, and pin conversations.
- Search conversations by title and message content.
- Infinite scroll / pagination for long histories.

### A3 — Message actions
Per message: copy, edit (user messages), regenerate (assistant messages).
- Editing a user message forks the conversation from that point.
- Regenerate produces an alternative; users can switch between variants.
- Variants stored as a tree; UI shows "2 / 3" style navigation.

### A4 — Markdown + code rendering
Assistant output renders Markdown.
- Syntax-highlighted code blocks with language label and copy button.
- Tables, lists, blockquotes, math (KaTeX), and links.
- Safe rendering — sanitize HTML, no script execution.

### A5 — Conversation branching
A conversation is a tree, not a flat list.
- Each message node has a parent; the active path is the rendered thread.
- Switching variants re-roots the active path.

---

## B. Model and generation control

### B1 — Provider-agnostic model layer
All generation goes through a `ModelProvider` adapter interface.
- Adapters: OpenAI, Google Gemini, Anthropic, Ollama (local).
- Each adapter normalizes streaming, tool calls, token usage, errors.
- New providers added by dropping one file in `/packages/providers`.

### B2 — Model picker
User selects which model handles a conversation.
- Per-conversation model selection, with a global default.
- Show context-window size and rough cost tier in the picker.

### B3 — Generation parameters
Adjustable: temperature, max output tokens, system prompt.
- Saved per conversation; sensible defaults.
- Optional "advanced" panel — top-p, stop sequences, etc.

### B4 — Token usage and cost
Track and display token usage.
- Per-message and per-conversation token counts.
- Optional cost estimate using a configurable price table.

---

## C. Projects (workspaces)

### C1 — Projects
Group related conversations under a project.
- A project has a name, description, and custom instructions.
- Conversations belong to zero or one project.
- Project custom instructions are prepended to the system prompt.

### C2 — Project knowledge
Each project holds a set of reference documents.
- Upload files into project knowledge.
- Documents are chunked, embedded, and retrievable (RAG) in any
  conversation within that project.

---

## D. Files and attachments

### D1 — File upload
Attach files to a message.
- Supported: images, PDF, txt, md, csv, docx, code files.
- Drag-and-drop and paste-from-clipboard.
- Size limits enforced; clear error messages.

### D2 — File understanding
The model can read attached files.
- Images sent to vision-capable models directly.
- PDF / docx text extracted server-side.
- CSV parsed; large files chunked or summarized before sending.

### D3 — File generation / artifacts
The assistant can produce downloadable files.
- Generated documents, spreadsheets, and code files are downloadable.
- See E1 for the in-chat preview side of this.

---

## E. Artifacts (live preview panel)

### E1 — Artifact rendering
Substantial generated content opens in a side panel, separate from chat.
- Supported artifact types: Markdown docs, HTML, React components,
  SVG, Mermaid diagrams, code files.
- HTML and React artifacts render in a sandboxed iframe.
- Versioned — each edit is a new version; users can step back.

### E2 — Artifact editing
Ask for changes; the artifact updates in place.
- Diff view between versions.
- Download and copy buttons.

### E3 — Sandbox safety
Artifact iframe is fully sandboxed.
- No access to parent window, cookies, or network beyond an allowlist.
- No `localStorage` reliance; document this constraint.

---

## F. Tools / function calling

### F1 — Tool framework
The model can call server-defined tools mid-generation.
- Tool = name + JSON schema + handler.
- Multi-step tool loops until the model returns a final answer.
- Tool calls and results shown in the UI, collapsible.

### F2 — Web search tool
A built-in tool that searches the web and returns results.
- Pluggable search backend (e.g. a search API).
- Results cited inline in the assistant reply with source links.

### F3 — Code execution tool
A sandboxed tool that runs code and returns output.
- Runs in an isolated container with no host access and a time limit.
- Used for data analysis, calculation, file generation.

### F4 — MCP-style connector framework
A standard interface for third-party tool servers.
- A connector registry; tools from connected servers become callable.
- Per-connector enable/disable and auth.

---

## G. Memory and personalization

### G1 — Cross-conversation memory
Facts from past conversations inform future ones.
- Memory items are extracted, stored, embedded, and retrieved by relevance.
- A memory management UI: view, edit, delete individual items.
- A global toggle and an incognito mode that writes no memory.

### G2 — Search past conversations
The assistant can retrieve content from prior conversations on request.
- A retrieval tool over the user's conversation history (scoped to them).

### G3 — User preferences
Persistent settings that shape every reply.
- Custom instructions (tone, format, role context).
- Response style presets (concise, formal, etc.).

---

## H. Voice and input modes

### H1 — Speech-to-text
Dictate a message.
- Browser SpeechRecognition or a server STT provider.

### H2 — Text-to-speech
Read assistant replies aloud (optional).

---

## I. Accounts, sharing, collaboration

### I1 — Authentication
Sign up / sign in.
- Email + password and at least one OAuth provider.
- Sessions, password reset, email verification.

### I2 — Conversation sharing
Share a read-only snapshot of a conversation via link.
- Snapshot is immutable; later edits do not change the shared copy.
- Revoke a share link.

### I3 — Export
Export a conversation as Markdown, JSON, or PDF.

### I4 — Usage limits
Per-user rate and quota limits.
- Configurable tiers; clear messaging when a limit is hit.

---

## J. Settings and admin

### J1 — Settings UI
Account, appearance (light/dark/system), data controls,
model defaults, connectors, memory.

### J2 — Data controls
Export all data; delete account; clear all conversations.

### J3 — Admin panel (optional)
User management, usage dashboards, provider key management.

---

## K. Non-functional requirements

- **Accessibility**: keyboard navigable, ARIA roles, focus management,
  respects reduced-motion.
- **Responsive**: works on mobile, tablet, desktop.
- **Performance**: first reply token under ~1s of network round-trip;
  conversation list virtualized.
- **i18n**: all UI strings in a locale file; English default.
- **Observability**: structured logs, request tracing, error reporting.
- **Security**: input validation everywhere, CSRF protection, rate limits,
  secrets never in client bundle, sandboxed artifact + code execution.
- **Testing**: unit tests for provider adapters, tool loop, memory
  retrieval; e2e tests for the core send/receive flow.

---

## Priority tiers

- **Tier 1 (MVP)**: A1–A4, B1–B2, D1–D2, I1.
- **Tier 2**: A2–A3, A5, B3–B4, E1–E3, F1–F2, I2–I3.
- **Tier 3**: C1–C2, F3–F4, G1–G3, H1–H2, J1–J3, I4.

Build in tier order. See `docs/04-build-roadmap.md` for the phased plan.
