# 02 — Architecture

## High-level shape

```
Browser (React SPA)
   |  HTTPS + SSE
Hono API server (Node)
   |-- Auth (sessions)
   |-- Conversation service
   |-- Generation orchestrator  --->  ModelProvider adapter  ---> provider API
   |-- Tool runtime             --->  tool handlers (web search, code exec, MCP)
   |-- Memory service           --->  pgvector
   |-- File service             --->  S3-compatible storage
   |
PostgreSQL (+ pgvector)
```

The SPA never talks to a model provider directly. All generation flows
through the server so that keys, tool execution, and memory stay server-side.

---

## The generation orchestrator

This is the heart of the app. One request to `POST /api/conversations/:id/messages`
triggers this loop:

1. Load the active message path (the conversation tree branch).
2. Build the prompt:
   - system prompt = base + user custom instructions + project instructions
   - inject retrieved memory items (G1)
   - inject retrieved project knowledge / RAG chunks (C2)
3. Pick the provider adapter for the conversation's model.
4. Open an SSE stream to the client.
5. Call the adapter's `stream()` method.
6. If the model emits a tool call:
   - run the tool via the tool runtime
   - append the tool result to the message list
   - loop back to step 5
7. When the model finishes, persist the assistant message.
8. Asynchronously: extract memory candidates, generate a title if first turn.

Keep this loop in one well-tested module. It is provider-agnostic — it only
knows the `ModelProvider` interface.

---

## ModelProvider interface

Every provider adapter implements exactly this. Define it in
`packages/shared` and implement in `packages/providers`.

```ts
interface ModelProvider {
  id: string;                       // "openai", "gemini", "anthropic", "ollama"
  listModels(): Promise<ModelInfo[]>;
  stream(req: GenerationRequest): AsyncIterable<GenerationEvent>;
}

type GenerationEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; args: unknown }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "done"; finishReason: string }
  | { type: "error"; message: string };
```

The orchestrator consumes `GenerationEvent`s and never branches on provider id.

---

## Data model (PostgreSQL via Drizzle)

```
users           id, email, password_hash, created_at
sessions        id, user_id, expires_at
user_settings   user_id, custom_instructions, theme, default_model, memory_enabled

projects        id, user_id, name, description, instructions
project_files   id, project_id, filename, storage_key, status

conversations   id, user_id, project_id?, title, model, params(jsonb),
                pinned, created_at, updated_at
messages        id, conversation_id, parent_id?, role, content(jsonb),
                model, token_usage(jsonb), created_at
                -- content is an array of parts: text | image | file | tool_call | tool_result
attachments     id, message_id, filename, storage_key, mime, extracted_text

memory_items    id, user_id, text, embedding(vector), source_conversation_id,
                created_at
conv_chunks     id, conversation_id, message_id, text, embedding(vector)
                -- powers "search past conversations" (G2)
doc_chunks      id, project_file_id, text, embedding(vector)
                -- powers project knowledge RAG (C2)

artifacts       id, conversation_id, kind, current_version
artifact_vers   id, artifact_id, version, content, created_at

connectors      id, user_id, name, type, config(jsonb), enabled
shares          id, conversation_id, snapshot(jsonb), token, revoked
```

Notes:
- `messages.parent_id` makes the tree (A5). The "active path" is computed
  by walking from a leaf up to the root.
- Three separate embedding tables keep memory, conversation search, and
  project RAG independent — different lifecycles and scopes.

---

## API surface (REST + SSE)

```
POST   /api/auth/signup            /login   /logout   /reset-password
GET    /api/conversations
POST   /api/conversations
GET    /api/conversations/:id
PATCH  /api/conversations/:id      rename, pin, move to project
DELETE /api/conversations/:id
POST   /api/conversations/:id/messages      -> SSE stream
POST   /api/conversations/:id/messages/:mid/regenerate
PATCH  /api/messages/:id           edit (forks the tree)
GET    /api/conversations/:id/search-history
POST   /api/conversations/:id/share         -> share token
GET    /api/share/:token                    public read-only
GET    /api/conversations/:id/export?format=md|json|pdf

GET    /api/projects   POST  /api/projects   PATCH/DELETE /api/projects/:id
POST   /api/projects/:id/files               upload + index

POST   /api/files                            generic upload
GET    /api/files/:id

GET    /api/memory   PATCH /api/memory/:id   DELETE /api/memory/:id
GET    /api/models
GET/POST/DELETE /api/connectors
GET    /api/settings   PATCH /api/settings
```

---

## Streaming protocol (SSE)

The message endpoint returns `text/event-stream`. Event names mirror
`GenerationEvent`: `text`, `tool_call`, `tool_result`, `usage`, `done`,
`error`. The client appends `text` deltas, renders `tool_call` /
`tool_result` as collapsible blocks, and closes on `done`.

A `stop` is a client-side `AbortController` plus a server check that
cancels the provider stream and persists the partial message.

---

## Tool runtime

```ts
interface Tool {
  name: string;
  description: string;
  schema: ZodSchema;          // -> JSON schema for the model
  handler(args, ctx): Promise<ToolResult>;
}
```

Built-in tools: `web_search`, `run_code`, `search_conversations`.
MCP connectors register additional `Tool`s dynamically. The orchestrator's
tool loop is capped (e.g. 10 iterations) to prevent runaway loops.

`run_code` executes inside an isolated container (gVisor / Firecracker /
a locked-down Docker sandbox) — no host filesystem, no network except an
allowlist, hard CPU and wall-clock limits.

---

## Security checklist

- All inputs validated with Zod at the route boundary.
- Provider keys and tool secrets only in server env.
- Artifact iframes: `sandbox` attribute, no `allow-same-origin` with
  `allow-scripts` together unless strictly needed; CSP locked down.
- Share snapshots strip user identity.
- Rate limiting per user and per IP.
- Memory and history retrieval always scoped to the requesting user.
