# 🧠 INDUS-BRAIN AI

> **Industrial Knowledge Intelligence Platform** — transforms industrial documents into actionable operational intelligence.

INDUS-BRAIN AI ingests industrial documents (manuals, SOPs, maintenance logs, incident reports) and turns them into a searchable, queryable knowledge layer. It combines **MongoDB Atlas** (system of record), **ChromaDB** (vector search / RAG), and the **Gemini API** (embeddings + generation) behind a clean-architecture Node/Express backend and a React + Vite + Tailwind + Shadcn frontend.

---

## 📐 Architecture

```
┌──────────────┐     HTTPS/JSON      ┌────────────────────────────┐
│   Frontend   │ ──────────────────► │          Backend           │
│ React + Vite │                     │   Express (Clean Arch)     │
│  TS/Tailwind │ ◄────────────────── │  routes → controllers →    │
│  Shadcn UI   │                     │  services → repositories   │
└──────────────┘                     └───────┬────────┬───────────┘
                                             │        │
                            ┌────────────────┘        └───────────────┐
                            ▼                 ▼                        ▼
                   ┌────────────────┐  ┌──────────────┐      ┌─────────────────┐
                   │ MongoDB Atlas  │  │   ChromaDB   │      │   Gemini API    │
                   │ (system of     │  │ (vector RAG) │      │ (embeddings +   │
                   │  record)       │  │              │      │  generation)    │
                   └────────────────┘  └──────────────┘      └─────────────────┘
```

### Backend clean-architecture layers (dependencies point inward)

| Layer            | Folder           | Responsibility                                   |
| ---------------- | ---------------- | ------------------------------------------------ |
| **Routes**       | `routes/`        | HTTP surface, URL → controller                   |
| **Controllers**  | `controllers/`   | Parse req/res, validation, status codes          |
| **Services**     | `services/`      | Business orchestration                           |
| **Repositories** | `repositories/`  | Data-access abstraction over models              |
| **Models**       | `models/`        | Mongoose schemas / domain entities               |
| **Integrations** | `integrations/`  | Gemini & ChromaDB clients (swappable)            |
| **Middleware**   | `middleware/`    | Cross-cutting: error handling, logging           |
| **Config**       | `config/`        | Environment loading & validation                 |

---

## 🗂 Project structure

```
indus-brain-ai/
├── frontend/          # React + Vite + TypeScript + Tailwind + Shadcn UI
├── backend/           # Express + TypeScript (clean architecture)
├── docs/              # Architecture & design documentation
├── datasets/          # Raw and processed industrial documents
├── docker-compose.yml # Local dev: mongo + chromadb + backend + frontend
└── package.json       # npm workspaces root
```

---

## 🚀 Getting started

### Prerequisites

- **Node.js** ≥ 20 and **npm** ≥ 10
- **Docker** + **Docker Compose** (for ChromaDB / optional local Mongo)
- A **MongoDB Atlas** connection string
- A **Gemini API** key

### 1. Install dependencies

```bash
npm install
```

> This installs both workspaces (`frontend`, `backend`) from the repo root.

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Fill in `backend/.env` with your MongoDB Atlas URI and Gemini API key.

### 3. Start infrastructure (ChromaDB, optional local Mongo)

```bash
npm run docker:up
```

### 4. Run in development

```bash
npm run dev
```

- Frontend → http://localhost:5173
- Backend  → http://localhost:4000
- Health   → http://localhost:4000/health

---

## 🧰 Scripts (root)

| Command               | Description                                       |
| --------------------- | ------------------------------------------------- |
| `npm run dev`         | Run backend + frontend concurrently               |
| `npm run dev:backend` | Run backend only                                  |
| `npm run dev:frontend`| Run frontend only                                 |
| `npm run build`       | Type-check + build both apps                       |
| `npm run start`       | Start the built backend                           |
| `npm run lint`        | Lint both workspaces                              |
| `npm run format`      | Format the repo with Prettier                     |
| `npm run docker:up`   | Start docker-compose services                      |
| `npm run docker:down` | Stop docker-compose services                       |

---

## 🔐 Environment variables

See [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example) for the full list with descriptions.

---

## 📄 License

MIT
