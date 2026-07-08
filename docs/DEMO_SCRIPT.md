# Hackathon Demo Script — INDUS-BRAIN AI

A tight ~6-minute live demo that tells a story: **"industrial knowledge is
trapped in PDFs — INDUS-BRAIN AI turns it into grounded, cited intelligence."**

## 0. Before you start (off-camera)

- [ ] ChromaDB running (`npm run docker:up` or the Python command) — `curl :8000/api/v2/heartbeat` returns 200.
- [ ] Backend + frontend running (`npm run dev`), `/api/health` shows `mongodb: connected`.
- [ ] Use a **paid/fresh Gemini key** so generation isn't rate/quota-limited mid-demo.
- [ ] Pre-load 4–6 documents about the **same equipment** (e.g. *Pump P101*) across categories: an **equipment manual**, a couple of **incident/maintenance/inspection** reports, and one **regulation** + one **SOP** for the compliance demo. Leave one fresh PDF aside to upload live.
- [ ] Dark mode on, browser zoom ~110%, only the app tab open.

## 1. Hook (30s)

> "Every plant runs on PDFs — manuals, SOPs, incident reports — and the knowledge
> inside them is effectively unsearchable. When a pump fails at 2 a.m., nobody has
> time to read 400 pages. INDUS-BRAIN AI turns that pile into an assistant that
> answers with citations, finds root causes, checks compliance, and learns from
> every failure."

Show the **Overview** dashboard — documents indexed, knowledge-graph nodes, vectors.

## 2. Ingestion — live (45s)

- Drag in the fresh PDF on the **Documents** page.
- Narrate the pipeline: *extract → (OCR if scanned) → chunk → embed → index → knowledge-graph extraction.*
- Point out the **honest status**: it shows `processed` only after vectors are indexed.

> "Notice it also pulled out entities and relationships automatically — that's our
> Mongo-backed knowledge graph, no Neo4j needed."

## 3. Knowledge Assistant — the "wow" (75s)

- Ask: **"What causes Pump P101 to overheat and how do I fix it?"**
- Call out: the **answer**, the **confidence score**, the **citations** (click one — it maps to a real page), **related equipment/entities**, and **suggested follow-ups**.
- Then ask something **not** in the corpus: **"What's the warranty on the turbine?"**

> "Watch — it refuses instead of hallucinating. Below a grounding threshold it won't
> even call the model. Everything it says is backed by a source."

## 4. Root Cause Analysis (60s)

- Go to **Root Cause Analysis**, enter: *"Pump P101 recurring bearing failure and high vibration."*
- Show the **likely root cause**, **supporting evidence (cited)**, **confidence**, **recommended actions**, and **preventive maintenance** — correlated across incident + maintenance + inspection docs.

> "It's reasoning across four different report types at once, and every claim is cited."

## 5. Compliance Intelligence (60s)

- Go to **Compliance**, pick the **SOP** and the **Regulation**, click **Analyze**.
- Show the **compliance score ring**, **missing requirements**, **conflicts**, **recommendations**, and the **requirement coverage matrix** (met / gap / missing) with cited regulation excerpts.

> "Score isn't a vibe from the model — it's computed from a per-requirement
> assessment, each one tied back to the regulation text."

## 6. Lessons Learned (45s)

- Go to **Lessons Learned**: the **dashboard** (repeated components, failure trend, frequent entities) loads instantly — pure data, no LLM.
- Click **Generate AI Summary** → recurring failures, most frequent problems, lessons, recommendations, all cited.

> "The dashboard is deterministic analytics; the summary on top is grounded AI.
> *Pump P101* surfaces as the repeat offender across every report."

## 7. Close (30s)

> "Clean-architecture TypeScript end to end, MongoDB + ChromaDB + Gemini, fully
> grounded — it refuses rather than makes things up, degrades gracefully under
> failure, and we just ran a production audit across 16 dimensions. This is
> deployable today for a Siemens, Bosch, or GE plant."

## Backup plan (if Gemini quota/network fails mid-demo)

- The **deterministic** surfaces still work with no LLM: Documents, the Lessons
  **dashboard**, Analytics, and the knowledge graph.
- The AI endpoints return a clean **"temporarily unavailable" (503)** — show that as
  *graceful degradation, never fabrication*, then continue with the dashboards.
- Have screenshots/a recording of a successful AI answer as a fallback.

## One-liners to keep handy

- "Grounded or it refuses — no hallucinations."
- "Every answer cites a real page."
- "No Neo4j — the knowledge graph is plain MongoDB."
- "Status is honest: `processed` means actually indexed."
- "Reuses one set of RAG primitives across five features."
