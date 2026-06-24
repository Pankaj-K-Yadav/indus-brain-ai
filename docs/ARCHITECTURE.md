# Architecture — INDUS-BRAIN AI

This document describes the platform architecture across Phase 1 (foundation +
document management) and Phase 2 (the Industrial Knowledge Intelligence engine).

## Phase 2 — Knowledge Intelligence Engine

### Ingestion / indexing pipeline (on upload)

```
PDF / DOCX
   │  multer (local uploads/)
   ▼
documentProcessor.service   extract text per page (pdfjs-dist / mammoth)
   │                        + intelligent overlapping chunks (page refs kept)
   ▼
embedding.service           Gemini embeddings (batched + retried + logged)
   ▼
vector.repository           upsert chunk vectors -> ChromaDB (cosine)
   ▼
document.repository         status: processed, indexed=true, chunkCount, pageCount
```

Extraction + chunking run locally and always succeed; embedding + indexing are
best-effort, so an upload never fails when Gemini/ChromaDB are unavailable (the
document is stored and marked `processed` / `indexed=false`).

### Retrieval / RAG flow (POST /api/knowledge/search)

```
query
  ▼ embedding.service.embedQuery            (Gemini RETRIEVAL_QUERY)
  ▼ vector.repository.query                 (ChromaDB top-K, cosine)
  ▼ filter by RAG_MIN_SIMILARITY            (refuse early if nothing relevant)
  ▼ knowledge.service builds grounded prompt (cite [n], refuse if unsupported)
  ▼ Gemini generateContent                  (gemini-2.5-flash)
  ▼ { answer, confidence, answered, sources[], retrievedChunks[] }
```

Anti-hallucination: the model answers ONLY from retrieved context, must cite
source excerpts, and returns `INSUFFICIENT_CONTEXT` (mapped to `answered:false`,
low confidence) when the documents don't support an answer.

### New modules

| Layer | File |
| ----- | ---- |
| Processing | `services/documentProcessor.service.ts`, `utils/chunking.ts` |
| Embeddings | `services/embedding.service.ts` (`utils/retry.ts`) |
| Vector store | `repositories/vector.repository.ts` |
| Knowledge / RAG | `services/knowledge.service.ts`, `controllers/knowledge.controller.ts`, `routes/knowledge.routes.ts` |
| Analytics | `services/analytics.service.ts`, `controllers/analytics.controller.ts`, `routes/analytics.routes.ts`, `models/searchLog.model.ts` |
| Industrial assistants | `general` / `sop` / `maintenance` / `incident` / `safety` (knowledge.service) |

---

## Phase 1 foundation

This section describes the structural foundation of the platform.

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
