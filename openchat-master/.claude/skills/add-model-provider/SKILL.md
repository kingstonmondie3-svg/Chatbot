---
name: add-model-provider
description: >
  Use when adding a new AI model provider adapter to OpenChat (e.g. a new
  vendor or a local model runtime). Covers the exact files to touch and the
  ModelProvider contract so the orchestrator and UI stay untouched.
---

# Skill: Add a model provider

## Rule
A provider SDK may be imported **only** inside `packages/providers/`.
The orchestrator and UI must never branch on a provider id.

## Steps

1. Create `packages/providers/<id>.ts` exporting a class that implements
   `ModelProvider` from `packages/shared`.

2. Implement the two methods:
   - `listModels()` — return the provider's models as `ModelInfo[]`
     (id, label, contextWindow, costTier, supportsVision, supportsTools).
   - `stream(req)` — an `AsyncIterable<GenerationEvent>`. Translate the
     provider's native stream into our event union:
     `text`, `tool_call`, `usage`, `done`, `error`.

3. Normalize carefully:
   - Map the provider's tool/function-call format to our `tool_call` event
     and accept our `tool_result` parts back in the message list.
   - Emit a final `usage` event with input/output token counts.
   - Convert provider errors into a single `error` event — never throw
     out of the iterator mid-stream.

4. Register the adapter in `packages/providers/index.ts` in the provider map.

5. Add the provider's key name to `.env.example` (placeholder only).

6. Add a unit test in `packages/providers/__tests__/<id>.test.ts` that
   feeds a recorded fixture stream and asserts the normalized events.

7. Run `pnpm typecheck && pnpm test`.

## Do not
- Do not modify the orchestrator, routes, or UI — a correct adapter needs
  zero changes there.
- Do not leak provider-specific types outside this file.
