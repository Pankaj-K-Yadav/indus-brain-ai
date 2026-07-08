# Production Audit — INDUS-BRAIN AI

Date: 2026-06-26 · Scope: full monorepo (backend + frontend). Method: 4 parallel
read-only audits across 16 dimensions, every finding manually verified before any
change. **Only verified issues were fixed; no speculative changes were made.**
Design decisions (auth model, async job queue) are recorded as recommendations,
not silently changed.

Legend: ✅ fixed · 🟡 recommended (deferred, no functional bug) · ⬜ verified healthy

## Checklist

| # | Dimension | Status | Notes |
|---|-----------|--------|-------|
| 1 | **Folder Structure** | ⬜ | Clean architecture intact (routes→controllers→services→repositories→models + integrations/middleware/utils/config). One stray binary fixed (see #2). |
| 2 | **Unused Code** | ✅ | Removed dead `HttpError.internal`, `ApiResponse` type, `isMongoConnected`. Kept `pingChroma` (used by the e2e harness — not actually dead). `eng.traineddata` added to `.gitignore`. |
| 3 | **Unused APIs** | 🟡 | `/api/graph/*` (5 read endpoints) have no frontend caller yet — **intentionally retained** for the planned graph UI; KG data is already consumed via `/knowledge/search` enrichment. Documented, not removed. |
| 4 | **Performance** | ✅ | Frontend route **code-splitting** (React.lazy) added — initial JS bundle 352 kB → 210 kB. Backend already parallelizes aggregations with `Promise.all`. |
| 5 | **Security** | ✅ | Escaped user regex (ReDoS/injection) in document search + KG search; added **rate limiting** (broad + tighter AI tier); verified `helmet`, CORS allow-list, validated uploads, no committed secrets, `npm audit` clean. |
| 6 | **TypeScript Types** | ⬜ | No `any` / `@ts-ignore` in either app. A few necessary library casts (`as never` for Chroma's embedding fn) left as-is with intent. |
| 7 | **Error Handling** | ⬜ | Every controller wrapped in `asyncHandler`; central error middleware; `unhandledRejection`/`uncaughtException` wired; no silent catches. |
| 8 | **Logging** | ✅ | Truncated user **query/problem** strings in logs (privacy) — full text still persisted in the search-log collection by design. No secrets/large fields logged. |
| 9 | **Scalability** | 🟡 | `runPipeline` runs inline on upload (extraction→OCR→embed→index). Works and keeps status honest; moving to a **background job queue** is the recommended next step (changes the upload contract, so deferred). |
| 10 | **API Consistency** | ⬜ | Uniform `{success,data}` / `{success,error}` envelope across all endpoints; health intentionally raw. Differing 502/503 codes are semantically correct (upstream vs. agent-unavailable). |
| 11 | **UI Consistency** | ✅ | Extracted shared `CitationCard` + `ListCard`; citation/list rendering unified across Knowledge/RCA/Compliance/Lessons. |
| 12 | **Accessibility** | ✅ | Dialog now has a **focus trap**, initial focus, and focus restoration. Icon buttons already had `aria-label`; inputs already labelled. |
| 13 | **Responsive Design** | ⬜ | Sidebar→drawer, responsive grids, column-dropping tables all verified. No fixed-width overflow. |
| 14 | **Code Duplication** | ✅ | Backend: extracted `truncate`, `parseJsonResponse`, `assertObjectId`, `escapeRegExp` into shared utils (was duplicated across 4–5 services). Frontend: shared `CitationCard`/`ListCard`. |
| 15 | **Memory Leaks** | ✅ | Tesseract OCR worker now **terminated on graceful shutdown**; unguarded `useEffect` fetches (Analytics/Compliance/Lessons) now use cancellation guards. |
| 16 | **Database Queries** | ✅ | Added `createdAt` index backing the default list sort. (`contentText` already `select:false`; entity/relationship fields already indexed; no N+1.) List pagination 🟡 recommended for very large corpora. |

## Verified fixes applied

**Backend**
- `utils/text.ts` (new): `truncate`, `escapeRegExp`. `utils/json.ts` (new): `parseJsonResponse`. `utils/validation.ts`: `assertObjectId`.
- Refactored `rca`, `compliance`, `lessons`, `knowledge`, `knowledgeGraph`, `document` services onto the shared helpers (dedup).
- `document.service.ts` + `knowledgeGraph.service.ts`: escape user input before `RegExp`/`$regex` (ReDoS/regex-injection).
- `middleware/rateLimit.ts` (new) + `app.ts`: broad API limiter (200/min) and AI limiter (30/min); disabled under `NODE_ENV=test`.
- `models/document.model.ts`: `index({ createdAt: -1 })`.
- `services/ocr.service.ts`: `terminateOcrWorker()`; `server.ts` calls it during shutdown.
- Logging: truncate query/problem; removed dead exports; `.gitignore` `*.traineddata`.

**Frontend**
- `App.tsx`: `React.lazy` + `Suspense` route code-splitting.
- `components/ui/dialog.tsx`: focus trap + initial/restored focus.
- `components/ui/citation-card.tsx`, `components/ui/list-card.tsx` (new shared); adopted in RCA/Compliance/Lessons.
- Cancellation guards on data-fetching effects (Analytics/Compliance/Lessons).

## Recommendations (deferred — not bugs)

1. **Background job queue** for the ingestion pipeline (return `202 processing`, process async) — improves upload latency and horizontal scaling.
2. **List pagination** on `GET /api/documents` for very large corpora.
3. **AuthN/AuthZ** if the API will be internet-facing (currently open — fine for an internal/demo tool).
4. **Rotate** the Mongo/Gemini credentials that have lived in the local `.env` (never committed, but hygiene).
5. Plan a **multer 2.x** upgrade (1.x is in maintenance; current `npm audit` is clean).

## Verification

- Backend + frontend: typecheck ✅ · lint ✅ · build ✅
- E2E knowledge pipeline: **16/16**
- Audit-fix harness (regex escaping, rate-limit 429 envelope): **7/7**
- All 7 lazy routes render with no console errors; modal focus trap verified.
