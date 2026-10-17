# 05 — Developing This With Claude Code

This is the operating manual for building OpenChat with Claude Code. Read it
fully before Phase 0.

---

## 1. CLAUDE.md — the project's memory

`CLAUDE.md` at the repo root is loaded into context at the start of every
Claude Code session. It is the single most important file for keeping the
build on track. Rules:

- Keep it under ~150 lines. It is context, not documentation — be terse.
- It states: stack, layout, conventions, critical rules, current phase.
- Update the "Current phase" line as you finish each phase.
- When a convention changes, change it here in the same commit.

You can also place a scoped `CLAUDE.md` inside a subdirectory (e.g.
`packages/providers/CLAUDE.md`) — Claude Code picks up the nearest one for
files in that tree. Use this for the provider-adapter contract so it is
always in context when editing an adapter.

Personal, machine-specific notes go in `CLAUDE.local.md` (gitignored).

---

## 2. Skills — reusable procedures for this repo

A skill is a folder with a `SKILL.md` that teaches Claude Code a repeatable
procedure. They live in `.claude/skills/<name>/SKILL.md`. Claude Code loads a
skill's instructions only when the task matches its description, so they cost
no context until needed.

This repo ships three skills (already in `.claude/skills/`):

- **add-model-provider** — the exact steps to add a new provider adapter
  without touching the orchestrator or UI.
- **add-feature** — the standard vertical-slice flow:
  types -> Zod schema -> DB migration -> API route -> client hook -> UI -> tests.
- **db-migration** — how to evolve the Drizzle schema safely.

Write a new skill whenever you notice yourself giving Claude Code the same
multi-step instructions twice. Keep each `SKILL.md` focused and concrete;
put long reference material in sibling files the skill points to.

---

## 3. Custom slash commands

Put reusable prompts in `.claude/commands/` as Markdown files; each becomes a
`/command`. Suggested commands for this repo:

- `/phase` — "Read docs/04-build-roadmap.md, tell me the current phase from
  CLAUDE.md, and propose the next concrete task."
- `/review` — "Review the current diff against docs/01-feature-spec.md and
  the conventions in CLAUDE.md. List violations."
- `/ship` — "Run typecheck and tests, update the CHANGELOG and the
  CLAUDE.md phase line, then summarize what changed."

`$ARGUMENTS` in a command file is replaced by whatever the user types after it.

---

## 4. Plan first, then build

For anything non-trivial, ask Claude Code to produce a plan before it writes
code (use plan mode / "don't write code yet, outline the approach"). Review
the plan against the feature spec, correct it, then let it implement. This
is the single biggest lever for not "losing the plot" on a large build.

---

## 5. Subagents for isolation

Use subagents for work that would otherwise flood the main context:

- a **research subagent** to read a provider's API docs and report back the
  streaming + tool-call shape, so the main session only sees the summary;
- a **review subagent** to check a diff against the spec;
- a **test-writing subagent** to generate tests for a finished module.

Define reusable subagents under `.claude/agents/` with a tailored system
prompt and a restricted tool set.

---

## 6. Permissions and safety

- Configure allowed/denied tools in `.claude/settings.json` (commit it) and
  personal overrides in `.claude/settings.local.json` (gitignore it).
- Allow routine commands (`pnpm *`, `git status`, `git diff`) so you are not
  approving each one; keep destructive commands behind confirmation.
- Never put real API keys in any file Claude Code reads. Keys live in `.env`,
  which is gitignored; `.env.example` holds only placeholder names.

---

## 7. Hooks

`.claude/hooks/` can run scripts on events. Useful here:

- a **post-edit hook** that runs Prettier + ESLint on changed files;
- a **pre-commit-style hook** that runs `pnpm typecheck`.

This keeps every change consistent without you asking.

---

## 8. MCP servers for Claude Code itself

Separate from the app's connector feature: you can give Claude Code its own
MCP servers (e.g. a Postgres server to inspect the dev database, a GitHub
server to manage issues). Configure these in `.mcp.json`. Keep them
read-only where possible.

---

## 9. Context hygiene — the rules that keep a long build on track

1. One phase at a time. Finish, ship, then `/clear` context before the next.
2. Keep `CLAUDE.md` current — stale context causes drift.
3. Prefer many small, reviewed diffs over one giant change.
4. After each phase, write the CHANGELOG entry — it becomes a breadcrumb
   trail for future sessions.
5. If Claude Code starts guessing about scope, point it back at
   `docs/01-feature-spec.md` — that file is the source of truth.
6. Re-run the relevant phase prompt verbatim if a session goes off-track;
   the prompts in `docs/prompts/` are written to be self-contained.

---

## 10. Recommended session loop

```
/phase                      # what are we doing
(review the proposed task)
"Plan this, don't code yet"  # get a plan
(correct the plan)
"Implement the plan"         # build
/review                     # check against spec
/ship                       # typecheck, test, changelog, phase bump
git commit
/clear                      # fresh context for the next task
```
