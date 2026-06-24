# Setup instructions — INDUS-BRAIN AI

## Prerequisites

| Tool             | Version    |
| ---------------- | ---------- |
| Node.js          | ≥ 20       |
| npm              | ≥ 10       |
| Docker + Compose | latest     |
| MongoDB Atlas    | account    |
| Gemini API key   | required   |

## 1. Clone & install

```bash
git clone <your-repo-url> indus-brain-ai
cd indus-brain-ai
npm install
```

`npm install` at the root installs both workspaces (`frontend` and `backend`).

## 2. Environment configuration

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env`:

- `MONGODB_URI` — your MongoDB Atlas connection string.
- `GEMINI_API_KEY` — your Gemini API key.
- `CHROMA_URL` — defaults to `http://localhost:8000` (local Docker ChromaDB).

## 3. Start infrastructure

```bash
npm run docker:up      # starts mongo + chromadb
npm run docker:logs    # follow logs (optional)
```

To verify ChromaDB:

```bash
curl http://localhost:8000/api/v2/heartbeat
```

## 4. Development

```bash
npm run dev            # backend (4000) + frontend (5173)
```

Individual apps:

```bash
npm run dev:backend
npm run dev:frontend
```

## 5. Production build

```bash
npm run build          # type-check + build both
npm run start          # run built backend
```

## 6. Full containerized run

```bash
docker compose up --build
```

This builds and runs all four services together.

## Troubleshooting

- **Port conflicts** — ensure 4000, 5173, 8000, 27017 are free.
- **ChromaDB not ready** — wait for the healthcheck to pass before the backend connects.
- **Env not loaded** — confirm `.env` files exist in `backend/` and `frontend/`.
