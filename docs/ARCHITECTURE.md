# Architecture — INDUS-BRAIN AI

This document describes the technical foundation of the platform. No business logic is included here yet; this is the structural blueprint.

## 1. System overview

INDUS-BRAIN AI is a monorepo (npm workspaces) with two deployable applications and supporting infrastructure:

- **frontend** — React + Vite + TypeScript SPA (Tailwind + Shadcn UI)
- **backend** — Express + TypeScript API following clean architecture
- **MongoDB Atlas** — primary system of record
- **ChromaDB** — vector database for semantic search / RAG
- **Gemini API** — embeddings and text generation

## 2. Backend layering

Dependencies flow inward. Outer layers depend on inner layers, never the reverse.

```
HTTP → routes → controllers → services → repositories → models → (MongoDB)
                                   │
                                   └──► integrations → (Gemini, ChromaDB)
```

- **routes/** — declare endpoints and bind them to controllers.
- **controllers/** — translate HTTP ↔ application calls; validation and status codes live here.
- **services/** — orchestrate use cases (added later). The only layer allowed to combine repositories and integrations.
- **repositories/** — encapsulate persistence; the rest of the app never imports Mongoose directly.
- **models/** — Mongoose schemas and domain types.
- **integrations/** — thin, swappable clients for external systems (Gemini, ChromaDB).
- **middleware/** — error handling, request logging, future auth.
- **config/** — typed, validated environment configuration loaded once at startup.

## 3. Frontend layering

```
pages → features → components → components/ui (shadcn primitives)
            │
            └──► services (typed API client) → backend
```

- **pages/** — route-level composition.
- **features/** — domain-specific UI modules (added later).
- **components/** — shared presentational components; **components/ui/** holds Shadcn primitives.
- **services/** — centralized, typed HTTP access to the backend.
- **store/** — cross-cutting client state.
- **hooks/**, **lib/**, **types/** — reusable hooks, utilities, shared types.

## 4. Cross-cutting concerns

- **Type safety** end-to-end (TypeScript on both sides; strict mode).
- **Configuration** validated at boot; the app fails fast on missing env.
- **Error handling** centralized in backend middleware.
- **Containerization** via docker-compose for reproducible local dev.

## 5. Deployment topology (local)

`docker-compose.yml` brings up `mongo`, `chromadb`, `backend`, and `frontend` on a shared bridge network with healthchecks and named volumes for persistence.
