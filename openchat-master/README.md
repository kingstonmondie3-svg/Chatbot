<div align="center">

# OpenChat

**An open-source AI chat assistant with full feature parity to modern assistant products.**

Provider-agnostic · Self-hosted · Privacy-first · Extensible

[![CI](https://github.com/akaradje/openchat/actions/workflows/ci.yml/badge.svg)](https://github.com/akaradje/openchat/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-≥20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

---

## Overview

OpenChat is a full-stack, self-hosted AI chat application that connects to multiple AI model providers through a single unified interface. It supports conversations, projects with knowledge bases (RAG), persistent memory, artifact generation, web search, code execution, and more — all with a clean, original UI built from scratch.

**No vendor lock-in.** Switch between OpenAI, Anthropic, Google Gemini, DeepSeek, MiMo, or any model on OpenRouter without changing your workflow.

## Features

### Core Chat
- **Multi-provider support** — OpenAI, Anthropic, Google Gemini, DeepSeek, MiMo, OpenRouter (600+ models via a single key)
- **Real-time streaming** — token-by-token SSE streaming with a stop button
- **Conversation branching** — edit any message to fork the conversation; navigate between variants
- **Rich markdown** — syntax-highlighted code, KaTeX math, tables, Mermaid diagrams
- **Model picker** — per-conversation model selection with context window and cost tier info
- **Generation parameters** — temperature, max tokens, and system prompt per conversation

### Artifacts & Tools
- **Artifact panel** — generated Markdown, HTML, React, SVG, Mermaid, and code in a side panel with versioning, diff view, and download
- **Web search** — real-time web search with inline citations (via Serper API)
- **Code execution** — run generated code in a sandboxed Docker container
- **Conversation search** — search across all your past conversations

### Projects & Knowledge
- **Projects** — organize conversations by project with custom instructions
- **Knowledge base (RAG)** — upload files (PDF, DOCX, text) → automatic chunking, embedding, and retrieval with cited sources
- **Vector search** — powered by pgvector with cosine similarity

### Memory & Personalization
- **Persistent memory** — the assistant remembers facts across conversations (auto-extracted, can be edited/deleted)
- **Incognito mode** — per-conversation opt-out from memory
- **Custom instructions** — global and per-project system prompts
- **Response style** — concise, balanced, detailed, or formal

### User Experience
- **Light / Dark / System theme** with a warm, editorial design language
- **Command palette** (⌘K / Ctrl+K) for quick navigation
- **File upload** — drag-and-drop + paste; PDF/DOCX text extraction; image pass-through to vision models
- **Conversation export** — export as Markdown
- **Responsive** — off-canvas sidebar on mobile, full-screen artifact panel
- **Accessibility** — focus-visible rings, prefers-reduced-motion, ARIA labels

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 · TypeScript · Vite 6 · Tailwind CSS · Radix UI · Zustand |
| **Backend** | Node.js · Hono 4 · Zod 4 · Server-Sent Events |
| **Database** | PostgreSQL 16 · Drizzle ORM · pgvector |
| **Auth** | Session-based · argon2 password hashing |
| **File Storage** | S3-compatible (MinIO) or local filesystem |
| **Infra** | Docker Compose · pnpm workspaces · GitHub Actions CI |

## Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 10 (`npm i -g pnpm`)
- **Docker** (for PostgreSQL, Redis, MinIO)
- At least one AI provider API key

### 1. Clone & Install

```bash
git clone https://github.com/akaradje/openchat.git
cd openchat
pnpm install
```

### 2. Start Infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL (with pgvector), Redis, and MinIO.

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your API key(s):

```env
# At minimum, add one model provider key:
OPENAI_API_KEY=sk-...

# For web search:
SERPER_API_KEY=...

# For code execution:
CODE_EXECUTION_ENABLED=true
```

### 4. Push Database Schema

```bash
pnpm db:push
```

### 5. Run Development Server

```bash
pnpm dev
```

The app will be available at **http://localhost:5173** (API on port 3001).

## Project Structure

```
openchat/
├── apps/
│   ├── web/                  # React SPA (Vite)
│   │   ├── src/
│   │   │   ├── components/   # UI components
│   │   │   ├── pages/        # Route pages
│   │   │   ├── stores/       # Zustand state stores
│   │   │   └── lib/          # Utilities (SSE, artifacts, uploads)
│   │   └── index.html
│   └── server/               # Hono API server
│       └── src/
│           ├── routes/       # REST API routes
│           ├── orchestrator.ts  # Generation orchestrator
│           └── tools/        # Tool runtime (web search, code exec, etc.)
├── packages/
│   ├── shared/               # Types & Zod schemas
│   └── providers/            # Model provider adapters
│       ├── openai.ts
│       ├── anthropic.ts
│       ├── gemini.ts
│       ├── deepseek.ts
│       ├── mimo.ts
│       └── openrouter.ts
├── drizzle/                  # Database schema & migrations
├── docker/
│   └── sandbox/              # Sandboxed code execution container
├── docs/                     # Specifications & roadmap
└── docker-compose.yml        # PostgreSQL, Redis, MinIO
```

## Available Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run web + server in parallel |
| `pnpm build` | Type-check + production build |
| `pnpm typecheck` | TypeScript type-checking |
| `pnpm test` | Run all unit tests |
| `pnpm lint` | ESLint |
| `pnpm db:push` | Apply schema to local PostgreSQL |
| `pnpm db:studio` | Open Drizzle Studio (database GUI) |

## Model Providers

| Provider | Models | Notes |
|----------|--------|-------|
| **OpenAI** | GPT-4o, GPT-4o-mini, GPT-4 Turbo | Also used for embeddings |
| **Anthropic** | Claude 4.x, Claude 3.5 | Full tool-calling support |
| **Google Gemini** | Gemini 2.0, Gemini 1.5 | Multimodal support |
| **DeepSeek** | DeepSeek V4, DeepSeek Chat | Thinking/reasoning mode |
| **MiMo** | MiMo v2.5 | Thinking/reasoning mode |
| **OpenRouter** | 600+ models | One key for all models |

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure `pnpm typecheck && pnpm test` passes before submitting.

## License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

## Acknowledgments

Built with [Claude Code](https://claude.ai/code) as an AI-assisted development workflow. The entire codebase was iteratively designed and implemented following the phased build approach documented in `docs/`.

---

<div align="center">

**[Documentation](./docs/)** · **[Feature Spec](./docs/01-feature-spec.md)** · **[Architecture](./docs/02-architecture.md)** · **[Roadmap](./docs/04-build-roadmap.md)**

</div>
