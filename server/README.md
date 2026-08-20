# AI Agent — Server

Express + TypeScript backend for AI features (embedding, chat agent, MCP, trace, data-board AI).
This is the service `marketplace` / `app-gateway` call into for AI flows. Runs on **`:7100`**.

> **Open-source edition**: this server does **not** implement `assistant_apps` / `assistants`(create) /
> `guardrail` (paid features). See [Edition / limitations](#edition--limitations).

---

## Requirements

- Node.js ≥ 20
- **MongoDB** running on `localhost:27017` (chat/suggestion storage)
- **Redis** running on `localhost:6379` (event bus) — with Docker:
  `docker run -d --name imbrace-redis -p 6379:6379 redis:7-alpine`

---

## Installation

> Dependencies live **in this directory** (`ai-agent/server/`), not in the root `ai-agent/`.

```bash
cd ai-agent/server
npm install
```

---

## Configuring `.env`

The server reads **`ai-agent/.env`** (the parent directory — shared, **not** `server/.env`).
Copy it from the template and edit:

```bash
cp ai-agent/.env.example ai-agent/.env
```

Minimum values for local development:

```env
PORT=7100
NODE_ENV=development
REDIS_URL=redis://localhost:6379
MONGODB_URI=mongodb://localhost:27017/messagesuggestion
```

Optional:
- `AISDK_CHAT_CLIENT_POSTGRES_URL` — Postgres for the chat client. **Optional**: leave it empty and the
  chat-client routes are disabled, the server still runs normally.
- `OPENAI_API_KEY` + `OPENAI_PROXY_URL` — needed for real LLM calls (embedding / chat).

---

## Running

```bash
npm run dev        # nodemon + ts-node (transpile-only) → http://localhost:7100
npm run build      # bundle with tsup
npm start          # run the build (dist/index.js)
```

Or, from the **monorepo root**, use the tagged runner with its own log file:

```bash
node dev-ai-agent.mjs   # logs/ai-agent.log
```

### Verifying

```bash
curl http://localhost:7100/health            # { "message": "OK", ... }
curl http://localhost:7100/api/health        # detailed health (db/redis/bus)
```

> If Redis is down, the log spams `Redis error / RedisBus pub|sub error` every ~2s (it does not kill the
> server, just noisy) — bring Redis back up and it stops. There is no flag to disable the bus, so just
> make sure Redis is running.

---

## API (mounted at `/api`, NO `/api/v1`)

| Group | Route |
|---|---|
| System | `/api/config`, `/api/health`, `/api/version` |
| Embedding | `/api/embedding/*` |
| Chat agent | `/api/chat`, `/api/v2/chat` |
| MCP | `/api/mcp/*` |
| Trace (Tempo) | `/api/trace/*` |
| Parquet | `/api/parquet/*` |
| Chat client | `/api/chat-client/*` |
| Data Board AI | `/api/data-board/suggest-field-types`, `/api/databoard/:id`, `/api/databoards` |
| Sub-agent guides | `/api/admin/guides/*` |
| Assistant **config** | `/api/assistants/*` (vibe-code config only: manifest / import-config / effective-config) |

---

## Edition / limitations

- **Not available**: `POST /api/v1/assistant_apps`, `/assistants` (create), `/guardrail`. As a result the
  marketplace flow `POST /v3/use-cases/v2/custom` (creating an AI assistant) returns **500** locally —
  marketplace calls `assistant_apps` and gets a 404. This is a paid feature, absent from the open-source
  edition. To use it, point `AI_SERVICE`/`AI_SERVICE_V2` (on the marketplace side) at an AI-v2 backend
  that implements it.
- Routes are mounted at `/api` (note: clients/marketplace calling `/api/v1/...` will get a 404).
