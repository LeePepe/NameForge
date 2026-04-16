# Repository Guidelines

## Project Structure & Module Organization
`frontend/` contains the React + TypeScript Vite app. Main UI code lives in `frontend/src/`, with API helpers under `src/api/` and reusable UI in `src/components/`. `backend/` contains the Express + TypeScript API; entrypoint is `backend/src/index.ts`, routes live in `backend/src/routes/`, and AI provider logic lives in `backend/src/services/`. Root-level deployment files include `Dockerfile`, `docker-compose.yml`, and CI in `.github/workflows/ci.yml`.

## Build, Test, and Development Commands
Run `npm install` at the repo root to install workspace dependencies. Use `npm run dev` to start the backend and frontend together with hot reload. Use `npm run build` from the root to build both workspaces, or target one side with `npm run build --workspace=frontend` and `npm run build --workspace=backend`. Frontend-only checks also support `npm run typecheck --workspace=frontend`.

## Coding Style & Naming Conventions
The codebase uses strict TypeScript in both workspaces. Follow the existing style: 2-space indentation, double quotes, semicolons, and small typed functions. Use `PascalCase` for React components (`NameForm.tsx`), `camelCase` for functions and variables (`generateNames`), and descriptive route or service filenames such as `names.ts` and `claude.ts`. No ESLint or Prettier config is checked in, so keep formatting consistent with surrounding files.

## Testing Guidelines
There is no automated test framework configured yet; current CI verifies builds only. Before opening a PR, run `npm run build` and manually verify the main flow: submit a project description, receive suggestions, and confirm error handling still works. If you add tests, keep them close to the code they cover and use `*.test.ts` or `*.test.tsx` naming.

## Commit & Pull Request Guidelines
Commit history follows Conventional Commit style, for example `feat: init NameForge`. Keep commits scoped and imperative, such as `fix: validate style prompt length`. PRs should include a short summary, linked issue when applicable, setup or env changes, and screenshots or short recordings for UI changes. Call out any provider-specific behavior you tested, such as `claude-code`, `anthropic-api`, or `ollama`.

## Security & Configuration Tips
Copy `backend/.env.example` to `backend/.env` for local setup and keep secrets out of git. Treat API keys and provider settings as backend-only configuration. When changing ports, CORS, or `VITE_API_URL`, update both runtime config and any deployment files affected by the change.
