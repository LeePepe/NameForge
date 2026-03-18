# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all dependencies (root + both workspaces)
npm install

# Start both frontend and backend concurrently with hot-reload
npm run dev

# Build both workspaces
npm run build

# Backend only
npm run dev --workspace=backend      # tsx watch (hot-reload)
npm run build --workspace=backend    # tsc compile to dist/
npm run start --workspace=backend    # node dist/index.js

# Frontend only
npm run dev --workspace=frontend     # vite dev server
npm run build --workspace=frontend   # tsc + vite build
npm run typecheck --workspace=frontend  # type-check without emitting

# Docker
ANTHROPIC_API_KEY=sk-ant-xxx docker compose --profile anthropic up
docker compose --profile ollama up
```

## Environment Setup

```bash
cp backend/.env.example backend/.env
# Set LLM_PROVIDER and any required keys
```

## Architecture

This is an **npm workspaces monorepo** with two packages: `frontend/` and `backend/`.

**Request flow:** React form → `frontend/src/api/nameApi.ts` → `POST /api/generate-names` → `backend/src/routes/names.ts` → `backend/src/services/claude.ts` → AI provider → JSON response with `{ suggestions: NameSuggestion[] }`.

### Backend (`backend/`)

- Express server (`src/index.ts`) with a single API route mounted at `/api`
- **`src/services/claude.ts`** is the AI provider abstraction — the only file that changes when adding new providers. It dispatches on `LLM_PROVIDER` env var to three implementations: `claude-code` (uses `@anthropic-ai/claude-agent-sdk` dynamically imported), `anthropic-api` (uses `@anthropic-ai/sdk`), `ollama` (direct HTTP to Ollama's OpenAI-compatible API)
- **`src/routes/names.ts`** validates input (`projectPrompt` 10–1500 chars, `stylePrompt` 0–2000 chars) and calls `generateNames()`
- In Docker single-container mode (`SERVE_STATIC=true`), Express also serves the compiled React app from `backend/public/` (built frontend is copied there in the Dockerfile)

### Frontend (`frontend/`)

- Vite + React 18 + TypeScript, no routing library (single page)
- **`src/api/nameApi.ts`** — API client; base URL from `VITE_API_URL` env var (defaults to `http://localhost:3001`)
- **`src/App.tsx`** — manages the 4-state machine: `form → loading → results | error`; the form is kept mounted (hidden) during error state so inputs survive retry
- Inline styles throughout (no CSS-in-JS library, no Tailwind)

### Deployment Modes

| Mode | How | Static serving |
|------|-----|----------------|
| Local dev | `npm run dev` (concurrently) | Vite dev server on :5173 |
| Docker | `docker compose --profile anthropic\|ollama up` | Express serves `/public` |
| Vercel | `vercel.json` routes `/api/*` to backend, `/*` to frontend | Vercel static CDN |

### Adding a New AI Provider

1. Add a new `generateWith<Provider>()` function in `backend/src/services/claude.ts`
2. Add a new `case` in the `switch` inside `generateNames()`
3. Document the new `LLM_PROVIDER` value and any required env vars in `.env.example`
