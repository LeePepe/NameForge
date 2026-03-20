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

# Run all tests
npm test

# Backend only
npm run dev --workspace=backend      # tsx watch (hot-reload)
npm run build --workspace=backend    # tsc compile to dist/
npm run start --workspace=backend    # node dist/index.js
npm run test --workspace=backend     # vitest run (once)
npm run test:watch --workspace=backend  # vitest (watch mode)

# Frontend only
npm run dev --workspace=frontend     # vite dev server
npm run build --workspace=frontend   # tsc + vite build
npm run typecheck --workspace=frontend  # type-check without emitting
npm run test --workspace=frontend    # vitest run (once)

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

**Request flow:** React form → `frontend/src/api/nameApi.ts` → `POST /api/generate-names-stream` (SSE) → `backend/src/routes/names.ts` → `backend/src/services/claude.ts` → AI provider → SSE events → `{ suggestions: NameSuggestion[] }`.

### Backend (`backend/`)

- `src/index.ts` — entry point; loads `.env` and starts the server
- `src/app.ts` — Express app factory; mounts CORS, JSON body parser, and the names router
- **`src/services/claude.ts`** is the AI provider abstraction. It exports two public functions:
  - `generateNames()` — blocking call, returns `NameSuggestion[]`
  - `generateNamesStream()` — async generator yielding `StreamEvent` (`token` | `done`)
  - Dispatches on `LLM_PROVIDER` env var to four providers: `claude-code`, `anthropic-api`, `ollama`, `azure-foundry`
  - `buildPrompt()` and `parseSuggestions()` are exported for unit testing
- **`src/routes/names.ts`** exposes two endpoints:
  - `POST /api/generate-names` — standard JSON response
  - `POST /api/generate-names-stream` — SSE stream with `token`, `result`, and `error` events; sends `: heartbeat` comments every 8 s to prevent proxy timeouts
- In Docker single-container mode (`SERVE_STATIC=true`), Express also serves the compiled React app from `backend/public/`

### Frontend (`frontend/`)

- Vite + React 18 + TypeScript, no routing library (single page)
- **`src/api/nameApi.ts`** — API client; calls the streaming endpoint, consumes SSE, resolves on `result` event. Throws `NameApiError` (with `statusCode`) on HTTP or SSE error events. Base URL from `VITE_API_URL` env var (defaults to `http://localhost:3001`)
- **`src/App.tsx`** — manages the 4-state machine: `form → loading → results | error`; the form is kept mounted (hidden) during error state so inputs survive retry
- Inline styles throughout (no CSS-in-JS library, no Tailwind)

### SSE Protocol (`/api/generate-names-stream`)

| Event | Data | Notes |
|-------|------|-------|
| `: heartbeat` | — | SSE comment, sent every 8 s |
| `event: token` | `{ text: string }` | Streamed token (azure-foundry, anthropic-api only) |
| `event: result` | `{ suggestions: NameSuggestion[] }` | Final result |
| `event: error` | `{ error: string }` | Error; connection closes after |

### Environment Variables

| Variable | Provider | Default | Notes |
|----------|----------|---------|-------|
| `LLM_PROVIDER` | all | `claude-code` | `claude-code`, `anthropic-api`, `ollama`, `azure-foundry` |
| `ANTHROPIC_API_KEY` | `anthropic-api` | — | Required |
| `ANTHROPIC_MODEL` | `anthropic-api` | `claude-opus-4-5` | Model override |
| `OLLAMA_BASE_URL` | `ollama` | `http://localhost:11434` | |
| `OLLAMA_MODEL` | `ollama` | `llama3.2` | |
| `AZURE_FOUNDRY_API_KEY` | `azure-foundry` | — | Required |
| `AZURE_FOUNDRY_ENDPOINT` | `azure-foundry` | — | Required |
| `AZURE_FOUNDRY_DEPLOYMENT` | `azure-foundry` | `Kimi-K2.5` | |
| `AZURE_FOUNDRY_API_VERSION` | `azure-foundry` | `2024-12-01-preview` | |
| `AZURE_FOUNDRY_STREAM_MAX_TOKENS` | `azure-foundry` | `8192` | Streaming token budget |

### Deployment Modes

| Mode | How | Static serving |
|------|-----|----------------|
| Local dev | `npm run dev` (concurrently) | Vite dev server on :5173 |
| Docker | `docker compose --profile anthropic\|ollama up` | Express serves `/public` |
| Vercel | `vercel.json` routes `/api/*` to backend, `/*` to frontend | Vercel static CDN |

### Adding a New AI Provider

1. Add a new `generateWith<Provider>()` function in `backend/src/services/claude.ts`
2. Optionally add `stream<Provider>()` for native streaming support
3. Add cases in both `generateNames()` and `generateNamesStream()` switch statements
4. Document the new `LLM_PROVIDER` value and required env vars in `.env.example`

### Testing

Tests use **Vitest** in both workspaces. Backend tests use `supertest` for route integration tests. Frontend tests mock `fetch` via `vi.stubGlobal`.

- `backend/src/services/claude.test.ts` — unit tests for `parseSuggestions` and `buildPrompt`
- `backend/src/routes/names.test.ts` — integration tests for both HTTP endpoints including SSE
- `frontend/src/api/nameApi.test.ts` — unit tests for the SSE client including multi-chunk parsing
