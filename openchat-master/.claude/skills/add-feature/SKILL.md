---
name: add-feature
description: >
  Use when implementing any new user-facing feature in OpenChat. Defines the
  standard vertical-slice order so features ship complete and consistent.
---

# Skill: Add a feature (vertical slice)

Build a feature top-to-bottom in this order. Do not skip steps.

1. **Spec check** — find the feature in `docs/01-feature-spec.md`. The
   acceptance criteria are the definition of done. If it is not in the spec,
   stop and ask before building.

2. **Types** — add or extend types in `packages/shared`.

3. **Zod schema** — add request/response validation schemas in
   `packages/shared`. Client and server both import these.

4. **Database** — if persistence is needed, follow the `db-migration` skill.

5. **API route** — add a Hono route in `apps/server`. Validate input with
   the Zod schema. Scope all data access to the authenticated user.

6. **Client hook** — add a TanStack Query hook in `apps/web` that calls the
   route. Streaming features use the SSE helper, not Query.

7. **UI** — build the component with Radix primitives + Tailwind. Keyboard
   accessible, ARIA roles, works on mobile.

8. **Tests** — unit-test the route logic and any non-trivial client logic.
   Add an e2e test if it is a Tier 1 flow.

9. **Finish** — run `pnpm typecheck && pnpm test`, add a CHANGELOG line.

## Reminders
- No raw SQL — Drizzle only.
- No provider SDK imports outside `packages/providers`.
- All UI original; never copy markup or styling from a commercial product.
