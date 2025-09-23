# Overview

Product: Codex Session Viewer — AI Chat & Insights (Mastra + Nexa).
Problem: Code review and debugging sessions are long, noisy logs that are hard to search, recall, or summarize. Users need privacy-preserving, session-grounded assistance that can answer questions, find moments, and produce summaries without uploading proprietary code.
Target users: individual developers, small teams, and privacy‑sensitive orgs who use the codex-session-viewer.
Value proposition: session-aware chat, one-click summaries, and smarter search that run locally via Nexa or switch to cloud models when desired. Minimal wiring, predictable costs, and better recall.
Scope: add agentic chat and insights to each session page; enable semantic search across sessions; persist memory; support local (Nexa) and cloud (OpenAI‑compatible) inference.
Constraints: offline-first option, OpenAI-compatible APIs, simple storage (LibSQL) with optional Postgres/pgvector scale-out, front-end frameworks (Next.js/Vite/React or Express) supported.

# Core Features

1) Session‑Aware Chat (Agent)
What: A “Session Analyst” agent that answers questions about the currently open session and cites steps/errors.
Why: Reduces time to understand what happened; eliminates context switching.
High‑level How: Mastra agent uses tools `get_session` and `search_sessions` to fetch ground truth; model runs on Nexa (local) or cloud via OpenAI-compatible base URL; responses stream to UI.
Acceptance criteria (BDD):
Given a user opens a session page with an ID
When the user asks a question in the Chat tab
Then the assistant streams an answer grounded in that session and includes at least one reference to a step or error in the log.

2) One‑Click Session Summary
What: Generate concise summaries listing key errors, fixes, commands, and outcomes.
Why: Fast handoffs and retros; easier navigation of long logs.
High‑level How: Same agent with a “summarize” instruction; result stored with session metadata for later view.
Acceptance criteria (BDD):
Given a loaded session with ≥100 lines
When the user clicks “Summarize session”
Then a summary appears within the UI with sections for Errors, Fixes, and Commands, and it is saved alongside the session record.

3) Semantic Search Across Sessions
What: Search sessions by meaning, not just keywords.
Why: Find similar incidents and solutions quickly.
High‑level How: Create embeddings via OpenAI-compatible `/v1/embeddings` (Nexa or cloud) and store vectors. Query top‑k; fall back to keyword search if embeddings unavailable.
Acceptance criteria (BDD):
Given embeddings are populated for sessions
When a user searches for a concept (e.g., “build pipeline cache miss”)
Then results return sessions that contain semantically related content ordered by similarity score.

4) Result Reranking (Optional)
What: Reorder candidate results for higher precision.
Why: Improves first‑click relevance.
High‑level How: Call `/v1/reranking` with query and candidate snippets; display top‑N.
Acceptance criteria (BDD):
Given a search returns ≥10 candidates
When reranking is enabled
Then the top 3 results after reranking differ from naive similarity rank in at least one case and show improved click‑through in internal testing.

5) Conversation Memory
What: Persist prior Q&A context per session and per user.
Why: Follow‑ups become smarter; reduces repeated prompts.
High‑level How: Mastra Memory with LibSQL store; optional migration to Turso/Postgres later.
Acceptance criteria (BDD):
Given a user has chatted about a session before
When they return and ask a related question
Then the agent references prior context without re-uploading or re-describing it.

6) Local/Cloud Model Switching
What: Seamlessly choose local Nexa or cloud models via configuration.
Why: Balance privacy, cost, and capability.
High‑level How: Use OpenAI‑compatible clients with configurable `baseURL` and key; model names resolved per provider.
Acceptance criteria (BDD):
Given the environment points to a local Nexa server
When the user invokes chat
Then requests are served locally; and when env switches to cloud
Then the same UI works unchanged and calls the cloud provider.

7) Streaming Responses (SSE)
What: Token‑level streaming to UI.
Why: Perceived latency improvements and better UX for long answers.
High‑level How: Agent `.stream()` forwarded as EventSource to client.
Acceptance criteria (BDD):
Given a long answer (>1,000 tokens)
When the user asks a question
Then partial tokens appear in the chat UI within 2 seconds and continue until completion.

# User Experience

Personas

- Individual Developer: wants quick answers about what broke and how it was fixed.
- Team Lead: needs high‑level summaries for reviews and standups.
- SRE/DevOps Engineer: searches past incidents for remediation steps.
- Privacy‑Conscious User: requires local inference and no external data transfer.

Key flows

- Open Session → Chat: User opens a session, asks “Why did the build fail?”, sees streamed answer with referenced steps.
- Summarize Session: Click “Summarize session” → stored summary panel appears on the session page.
- Search Sessions: Enter query in global search → semantic results with titles, scores, and quick‑open.
- Switch Models: Toggle “Local ↔ Cloud” in settings → no UI change on chat/search behavior.

UI/UX considerations

- Chat tab on session page with streaming bubbles and copy‑to‑clipboard.
- Summary panel with sections (Errors/Fixes/Commands) and links to log anchors.
- Search results include snippet previews and indicator for local vs cloud inference.
- Empty states and clear fallbacks when local server is offline.

Accessibility considerations

- Full keyboard navigation for chat input and message history.
- ARIA labels for chat controls; live region for streamed tokens.
- High‑contrast mode compliant; ensures focus states.
- Provide transcript export for screen readers.

# Technical Architecture

System components

- Frontend: Next.js/Vite React UI with Chat tab, Summary panel, Search UI.
- Backend API: Routes for chat (`/api/sessions/[id]/chat`), search, summarize.
- Agent Layer: Mastra agents, tools (`get_session`, `search_sessions`), and Memory.
- Inference: Nexa OpenAI‑compatible server (local) or cloud provider.
- Data: Sessions store (existing), LibSQL for memory, optional Postgres/pgvector for vectors.
- Streaming: Server‑sent events (SSE) from agent to client.

Data models (illustrative)

- Session { id, title, createdAt, messages[] }
- Message { id, sessionId, ts, role, text, meta }
- Summary { id, sessionId, createdAt, content, sections{errors[],fixes[],commands[]} }
- Embedding { id, sessionId, chunkId, vector, text }
- Memory { id, userId, sessionId, messages[], lastUsedAt }

APIs and integrations

- Chat: POST `/api/sessions/:id/chat` → streams tokens from agent.
- Summarize: POST `/api/sessions/:id/summarize` → returns and stores summary.
- Search: GET `/api/search?q=` → vector search + (optional) reranking.
- Embeddings job: background task to upsert vectors from sessions.
- OpenAI‑compatible endpoints: `/v1/chat/completions`, `/v1/embeddings`, `/v1/reranking`.

Infrastructure requirements

- Local: Nexa server process available; file‑based LibSQL DB for memory.
- Optional: Postgres with pgvector; network ACLs restricting egress when local‑only.
- Observability: request/latency logs, token counts, and error tracking.

Non‑functional requirements (NFRs)

- Performance: first token under 2s (p50) on local small model; search <300ms (p95) with warmed index.
- Reliability: graceful degradation to keyword search if embeddings/reranker unavailable.
- Privacy: no session content leaves machine when in local mode.
- Maintainability: minimal provider‑specific code via OpenAI‑compatible client.
- Portability: runs on macOS/Linux/Windows; works with Next.js or Express server.

Cross‑platform strategy

- Optional capabilities: GPU acceleration when available; Postgres/pgvector at scale; reranking for large result sets.
- Fallbacks: CPU‑only local inference or cloud provider; keyword search when embeddings missing; polling when SSE blocked by proxies.
- BDD fallback tests:
Given no local Nexa server is running
When the user sends a chat request
Then the system routes to the configured cloud provider and returns an answer.
Given embeddings are not present for any session
When a user searches
Then the system performs keyword search and returns results with a “fallback” indicator.
Given SSE is blocked by a proxy
When the user initiates chat
Then the client switches to long‑polling and still renders incremental updates.

Security and privacy considerations

- Sensitive data: session logs and code snippets; do not transmit off‑device in local mode.
- Secrets handling: obtain provider keys from environment only; never log secrets.
- Data retention: configurable TTL for memory and summaries; right‑to‑delete per session.
- Auditability: store minimal tool‑call metadata for troubleshooting.

# Development Roadmap

MVP

- Session‑Aware Chat with `get_session` tool and streaming UI.
- Local Nexa integration via configurable `baseURL`.
- Basic Memory persistence in LibSQL.
Acceptance criteria (BDD):
Given a session is open and Nexa is reachable
When a user asks a question
Then a streamed, grounded answer appears; and the conversation persists to LibSQL.

Phase 2

- One‑Click Session Summary stored with session metadata.
- Semantic Search with embeddings; basic keyword fallback.
Acceptance criteria (BDD):
Given embeddings are populated
When a user searches
Then results are ordered by similarity; and if embeddings are missing
Then keyword fallback triggers with a visible notice.

Phase 3

- Result Reranking; model selection UI; local↔cloud toggle.
- Health checks and empty states for offline local server.
Acceptance criteria (BDD):
Given reranking is enabled
When searching
Then reranker API is called and top‑N reflect reranked order.

Phase 4

- Observability (latency, token usage); exportable transcripts; summary versioning.
Acceptance criteria (BDD):
Given a chat completes
When metrics are queried
Then latency and token counts are recorded and viewable internally.

# Logical Dependency Chain

1) Foundations: access to session data; define tools (`get_session`, `search_sessions`); wire agent and SSE route.
2) Usable front end: Chat tab with streaming; empty/offline states.
3) Persistence: Memory store; summary storage.
4) Intelligence: embeddings job; search API; fallback logic.
5) Precision: reranking; model selection; settings UI.
6) Scale/ops: Postgres/pgvector option; observability; export tooling.

# Risks and Mitigations

- Local model quality/performance
Likelihood: Medium; Impact: Medium.
Mitigation: default to small fast model; allow cloud switch for complex queries.

- Session format variability
Likelihood: Medium; Impact: High.
Mitigation: normalize session schema; add adapters per source and validation tests.

- Embedding/reranker model mismatch
Likelihood: Low; Impact: Medium.
Mitigation: pin compatible models; add evaluation set and alerts on drift.

- SSE blocked by corporate proxies
Likelihood: Medium; Impact: Medium.
Mitigation: automatic long‑polling fallback; test behind proxy.

- Data privacy leakage to cloud
Likelihood: Low; Impact: High.
Mitigation: clear Local mode indicator; egress blocks; config check preventing cloud calls in local‑only projects.

- Storage growth for vectors and memory
Likelihood: Medium; Impact: Medium.
Mitigation: chunking strategy; TTLs; archive older vectors; pgvector at scale.

- Dependency changes in Nexa or Mastra
Likelihood: Medium; Impact: Medium.
Mitigation: wrap providers behind thin interfaces; smoke tests on upgrades.

- Cross‑platform differences (Windows/macOS/Linux)
Likelihood: Medium; Impact: Low.
Mitigation: containerized dev env; documented start scripts per OS.

# Appendix

Assumptions

- Existing sessions are accessible by ID with messages content.
- Front end is React (Next.js or Vite) with an existing session page.
- Local Nexa server exposes OpenAI‑compatible endpoints.
- LibSQL file storage is acceptable for MVP; Postgres is optional later.
- Users accept keyword search fallback when vectors are missing.
- Summaries are non-authoritative and can be regenerated.

Research findings and references (from README content only)

- Mastra provides agents, tools, memory, and streaming; LibSQL/Turso or Postgres/pgvector are viable stores.
- Nexa serves OpenAI‑compatible APIs for chat, embeddings, and reranking; supports local models and streaming.
- OpenAI‑compatible client can target Nexa via configurable `baseURL` and dummy API key for local.

Context notes (from README links)

- https://github.com/NexaAI/nexa-sdk — inferred: Nexa SDK; OpenAI‑compatible local inference server.
- https://github.com/AcidicSoil/codex-session-viewer — inferred: target repository to augment with chat/insights.

Technical specifications and glossary

- Mastra: agent framework with tools and memory.
- Nexa: local inference server exposing OpenAI‑compatible endpoints.
- LibSQL: file‑backed SQLite distribution; can run locally or via Turso.
- pgvector: Postgres extension for vector search.
- SSE: Server‑Sent Events for streaming tokens.
- BDD: Behavior‑Driven Development acceptance criteria format.
- Reranking: reorder candidates using a dedicated model.

