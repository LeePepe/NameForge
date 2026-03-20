# NameForge

AI-powered project name generator. Describe your project, pick a style, and get 6 memorable name suggestions — scored and explained.

Built with React + TypeScript (frontend) and Node.js + Express (backend). Supports multiple AI providers.

---

## AI Providers

| `LLM_PROVIDER` | Description | Requires |
|---|---|---|
| `claude-code` | Runs via Claude Code session (default) | Claude Code installed locally |
| `anthropic-api` | Calls Anthropic API directly | `ANTHROPIC_API_KEY` |
| `azure-foundry` | Azure AI Foundry / Azure OpenAI | `AZURE_FOUNDRY_ENDPOINT`, `AZURE_FOUNDRY_API_KEY` |
| `ollama` | Local LLM via Ollama | [Ollama](https://ollama.com) running locally |

---

## Local Development

### Prerequisites

- Node.js 20+
- One of the AI providers above

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/NameForge.git
cd NameForge

# Install all dependencies
npm install

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env and set LLM_PROVIDER + any required keys
```

### Run

```bash
# Start both frontend and backend with hot-reload
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

---

## Docker (Self-hosted)

### Anthropic API mode

```bash
ANTHROPIC_API_KEY=sk-ant-xxx docker compose --profile anthropic up
```

Open http://localhost:3001

### Ollama mode (fully local, no API key)

```bash
docker compose --profile ollama up

# Pull a model (first time only)
docker exec -it nameforge-ollama-1 ollama pull llama3.2
```

Open http://localhost:3001

### Azure Foundry mode

```bash
AZURE_FOUNDRY_ENDPOINT=https://your-resource.cognitiveservices.azure.com/ \
AZURE_FOUNDRY_API_KEY=your-key \
docker compose --profile azure-foundry up
```

Open http://localhost:3001

---

## Deploy to Azure Container Apps

Production deploys now target Azure Container Apps in `Southeast Asia` (Singapore) via GitHub Actions.

1. Create these GitHub repository secrets:
   - `AZURE_CREDENTIALS`
   - `AZURE_FOUNDRY_API_KEY`
2. Create these GitHub repository variables:
   - `AZURE_FOUNDRY_ENDPOINT`
   - `AZURE_FOUNDRY_DEPLOYMENT` (optional, defaults to `Kimi-K2.5`)
   - `AZURE_FOUNDRY_API_VERSION` (optional, defaults to `2024-12-01-preview`)
3. Push to `main`
4. The workflow will:
   - provision or update the Singapore Log Analytics workspace, Container Apps environment, ACR, and Container App from `infra/main.bicep`
   - build the Docker image in the Singapore ACR
   - deploy the new image to the Singapore Container App

The deployment keeps the existing `NameForge` resource group, but creates a separate Singapore application stack so it can coexist with the older `East US` deployment during migration.

---

## Deploy to Railway / Render

These platforms support Docker deployments out of the box.

**Railway:**
```bash
railway up
```

**Render:** Create a new Web Service, point to this repo, select "Docker" as runtime.

Set these environment variables on the platform:
```
LLM_PROVIDER=anthropic-api
ANTHROPIC_API_KEY=sk-ant-xxx
SERVE_STATIC=true
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `claude-code` | AI provider: `claude-code`, `anthropic-api`, `azure-foundry`, `ollama` |
| `ANTHROPIC_API_KEY` | — | Required when `LLM_PROVIDER=anthropic-api` |
| `ANTHROPIC_MODEL` | `claude-opus-4-5` | Anthropic model to use |
| `AZURE_FOUNDRY_ENDPOINT` | — | Required when `LLM_PROVIDER=azure-foundry` (e.g. `https://your-resource.cognitiveservices.azure.com/`) |
| `AZURE_FOUNDRY_API_KEY` | — | Required when `LLM_PROVIDER=azure-foundry` |
| `AZURE_FOUNDRY_DEPLOYMENT` | `Kimi-K2.5` | Azure Foundry model deployment name |
| `AZURE_FOUNDRY_API_VERSION` | `2024-12-01-preview` | Azure OpenAI API version |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.2` | Ollama model to use |
| `PORT` | `3001` | Backend server port |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin (dev mode) |
| `SERVE_STATIC` | `false` | Serve frontend from Express (Docker mode) |

---

## Project Structure

```
NameForge/
├── frontend/          # React + TypeScript + Vite
│   └── src/
│       ├── App.tsx
│       ├── api/       # API client
│       └── components/
├── backend/           # Node.js + Express + TypeScript
│   └── src/
│       ├── index.ts
│       ├── routes/
│       └── services/
│           └── claude.ts   # AI provider abstraction
├── Dockerfile         # Single-container production build
├── docker-compose.yml # Multi-profile orchestration
└── vercel.json        # Vercel deployment config
```

---

## License

MIT — see [LICENSE](LICENSE)
