# Project Flow — INDUS-BRAIN AI

End-to-end flows for the main journeys. All AI flows are grounded: answers are
built only from retrieved evidence and cite their sources.

## 1. Ingestion pipeline (upload)

```mermaid
sequenceDiagram
  participant U as User
  participant API as Express API
  participant DP as documentProcessor
  participant OCR as OCR (Tesseract)
  participant EMB as embeddingService (Gemini)
  participant CDB as ChromaDB
  participant KG as knowledgeGraphService
  participant DB as MongoDB

  U->>API: POST /api/documents (PDF/DOCX)
  API->>DB: create (status: processing)
  API->>DP: extract text (pdfjs-dist / mammoth)
  alt no text layer (scanned PDF)
    DP->>OCR: render pages → OCR
    OCR-->>DP: recovered text
  end
  DP-->>API: pages + chunks
  API->>KG: extract entities/relationships (best-effort)
  KG->>DB: upsert entities + relationships
  API->>EMB: embed chunks (batched + retry)
  EMB-->>API: vectors
  API->>CDB: upsert chunk vectors
  API->>DB: status: processed, indexed=true
  API-->>U: 201 document (honest status)
```

Extraction/chunking always succeed locally; embedding+indexing degrade gracefully
(document is stored `processed`/`indexed=false`). Status is `processed` **only**
after a successful vector upsert. KG extraction never blocks indexing.

## 2. Grounded RAG (Knowledge Assistant)

```mermaid
flowchart TD
  Q[Query] --> E[Embed query]
  E --> V[ChromaDB top-K]
  V --> F{Any chunk ≥ similarity floor?}
  F -- no --> R1[Refuse — no LLM call]
  F -- yes --> CF{Confidence ≥ floor?}
  CF -- no --> R2[Refuse politely — no LLM call]
  CF -- yes --> G[Gemini answer — cite n only]
  G --> S{Self-reports INSUFFICIENT_CONTEXT?}
  S -- yes --> R3[Refuse]
  S -- no --> A[Answer + confidence + sources + KG enrichment + follow-ups]
```

## 3. AI agents (RCA · Compliance · Lessons summary)

```mermaid
flowchart LR
  IN[Request] --> RET[Retrieve evidence<br/>embed + ChromaDB]
  RET --> CHK{Evidence found?}
  CHK -- no --> UND[Undetermined / empty<br/>no LLM, no fabrication]
  CHK -- yes --> LLM[Gemini JSON mode<br/>grounded prompt]
  LLM -- error/quota --> E503[HTTP 503 graceful]
  LLM -- ok --> OUT[Structured result<br/>+ citations + sources]
```

- **RCA**: retrieves across maintenance/incident/inspection/manual → root cause, evidence, recommended actions, preventive maintenance, confidence.
- **Compliance**: SOP text + regulation excerpts → per-requirement met/partial/missing, conflicts, deterministic score, recommendations.
- **Lessons**: deterministic dashboard (Mongo aggregations) + grounded AI summary of recurring failures / frequent problems / lessons.

## 4. Request lifecycle (every endpoint)

```mermaid
flowchart LR
  REQ[HTTP] --> H[helmet] --> CO[CORS] --> RL[rate limit] --> LOG[request logger]
  LOG --> RT[route] --> CT[controller: Zod validate] --> SV[service] --> RP[repository]
  SV -. throws .-> EH[error middleware → success:false envelope]
  RP --> RES[success:true, data]
```
