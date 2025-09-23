# Overview

Mastra × Nexa AI Layer for Codex Session Viewer adds local-first conversational assistance, one-click summaries, and semantic search to the existing session-viewing application. It targets developers, team leads, and analysts who review coding sessions and need fast, privacy-preserving insight extraction. The value proposition is a local OpenAI‑compatible stack (Nexa) that can switch to a cloud provider by configuration, minimizing vendor lock‑in while enabling responsive UX via token streaming and session-aware tools.

# Core Features

## 1) Session‑aware Chat
**What**: Conversational assistant on each session page that understands session metadata and content.
**Why**: Accelerates comprehension and investigation without leaving the viewer.
**High‑level How**: Next.js route calls a Mastra Agent configured with tools (`get_session`, `search_sessions`) and memory. Provider points to Nexa’s OpenAI‑compatible base URL; tool outputs are grounded into replies.
**Acceptance criteria (BDD)**
Given a loaded session and a running provider
When the user asks a question in the Chat tab
Then the response streams token‑by‑token and cites retrieved session artifacts by name or id

## 2) One‑click Session Summary
**What**: Generates a concise summary and key highlights for a session.
**Why**: Reduces ramp‑up time and supports triage.
**High‑level How**: Agent prompt template conditioned on session metadata; results cached per session/version.
**Acceptance criteria (BDD)**
Given a session with content
When the user clicks “Summarize session”
Then a summary with bullets of key events, files, and anomalies appears within 5 seconds of first token

## 3) Semantic Search Across Sessions
**What**: Search UI that retrieves relevant sessions by meaning, not just keywords.
**Why**: Finds prior art and related incidents quickly.
**High‑level How**: On ingest, chunk sessions and create embeddings; store vectors in a vector store; query by embedding, optionally rerank with a reranker model.
**Acceptance criteria (BDD)**
Given indexed sessions with embeddings
When the user searches for a concept
Then results are ordered by relevance and include matched snippets and scores

## 4) Local‑first / Cloud‑switchable Inference
**What**: Runs locally by default with the ability to switch to a cloud provider via configuration.
**Why**: Preserves privacy and cost locally; ensures reliability when local models are unavailable.
**High‑level How**: AI SDK provider constructed with env‑driven `baseURL` and `apiKey`; health checks determine current target.
**Acceptance criteria (BDD)**
Given the local inference server is unavailable
When the health check fails
Then the system switches to the configured cloud provider without user code changes and logs the transition

## 5) Streaming Responses (SSE)
**What**: Real‑time token streaming in chat and summarization.
**Why**: Improves perceived latency and usability.
**High‑level How**: Next.js route returns `text/event-stream` with a `ReadableStream` that forwards provider deltas.
**Acceptance criteria (BDD)**
Given a long response generation
When the route is called
Then tokens arrive incrementally and the UI renders partial text until completion

## 6) Tools and Memory Integration
**What**: Typed tools for session retrieval and search, plus short‑term conversation memory.
**Why**: Enables grounded, repeatable answers.
**High‑level How**: Mastra `createTool` for `get_session` and `search_sessions`; LibSQL store for transient memory; durable store optional.
**Acceptance criteria (BDD)**
Given a multi‑turn chat
When the user refers to a prior answer
Then the agent resolves references using stored conversation state and tool outputs

## 7) Result Reranking (Optional)
**What**: Reranks retrieved items for better ordering.
**Why**: Increases precision for ambiguous queries.
**High‑level How**: After initial embedding retrieval, call reranking with the query and candidate snippets; reorder by scores.
**Acceptance criteria (BDD)**
Given 10 candidate results with similar scores
When reranking is enabled
Then at least one of the top‑3 final results differs from the pre‑reranked top‑3 for ambiguous queries

## 8) Admin & Health
**What**: Status endpoint and UI indicator for current provider, model, and vector store health.
**Why**: Aids debugging and operations.
**High‑level How**: Health checks for provider, embeddings, vector DB; expose status in an admin panel and in the Chat tab header.
**Acceptance criteria (BDD)**
Given a failing dependency (e.g., vector store)
When the user opens the app
Then the UI shows a non‑blocking warning with actionable details

# User Experience

**Personas**
- Developer: Investigates sessions, asks targeted questions, needs speed and grounding.
- Team Lead: Skims summaries, compares sessions, needs relevance and signals.
- Analyst/Reviewer: Performs broad searches, exports findings, needs explainability.

**Key flows**
- Open Session → Chat tab → Ask → Streamed answer with citations.
- Open Session → Click “Summarize session” → Streaming summary → Copy/export.
- Global Search → Enter query → See ranked sessions with snippets → Open result.
- Settings → Select Inference Source (Local/Cloud) → Health indicator updates.

**UI/UX considerations**
- Progressive rendering for chat and summaries.
- Clear grounding: display which tools/sources were used.
- Empty, loading, and error states for each panel.
- Copy buttons for summaries and snippets; keyboard shortcuts for send.

**Accessibility**
- Keyboard navigation for all actions; focus management during streaming.
- Live region updates for token streams.
- Minimum contrast and scalable text; ARIA labels for controls and status.

# Technical Architecture

**System components**
- Next.js frontend and API routes for Chat, Summarize, Search, Admin/Health.
- AI SDK provider configured with OpenAI‑compatible base URL and API key.
- Nexa local server exposing chat, embeddings, and reranking endpoints.
- Mastra Agent with tools (`get_session`, `search_sessions`) and memory store.
- Ingest pipeline for chunking and embedding session content.
- Vector store (e.g., pgvector or file‑backed alternative for MVP).
- Optional reranker model for ordering candidates.

**Data models (logical)**
- Session(id, title, createdAt, meta, contentRef)
- Chunk(id, sessionId, order, text)
- Embedding(id, chunkId, vector, model, createdAt)
- ChatMessage(id, sessionId, role, content, ts)
- ToolInvocation(id, toolName, input, output, ts, sessionId)
- RerankScore(id, queryId, candidateId, score, model)

**APIs & integrations**
- Chat Completions: OpenAI‑compatible.
- Embeddings: OpenAI‑compatible.
- Reranking: OpenAI‑compatible.
- Next.js API routes: `/api/chat`, `/api/summarize`, `/api/search`, `/api/admin/health`.

**Infrastructure requirements**
- Local developer workstation capable of running a small LLM and an embedding model.
- Optional Postgres with vector extension for production‑grade semantic search.
- File‑backed LibSQL store for lightweight memory in MVP.
- Observability: logs for prompts, tool calls, errors (no secrets persisted).

**Non‑functional requirements (NFRs)**
- Latency: first token ≤ 2s on local models; p95 end‑to‑end chat ≤ 10s.
- Availability: core routes degrade gracefully when a dependency is down.
- Privacy: session content remains local when local mode is active.
- Maintainability: configuration via environment; no code changes for provider swap.
- Observability: structured logs with request ids and health check metrics.

**Cross‑platform strategy**
- Primary: Web (Next.js) with SSE token streaming.
- Optional capabilities: Local GPU/accelerator usage when available.
- Fallbacks across platforms:
  - If SSE unsupported, fall back to newline‑delimited incremental fetch.
  - If local inference is down, fall back to cloud provider via configuration.
  - If vector DB is unavailable, fall back to keyword search with client‑side scoring.

**BDD acceptance tests for fallbacks**
- Given a browser that blocks SSE
  When a chat request is made
  Then the client switches to incremental fetch and still renders partial tokens
- Given the local server is unreachable
  When a health check runs at startup
  Then the provider switches to cloud and a banner indicates the active source
- Given embeddings cannot be computed
  When a search is executed
  Then the system performs keyword search and labels results as “keyword‑based”

**Security & privacy**
- Sensitive data: session text and metadata; do not log raw content by default.
- Secrets handling: provider keys read from environment at runtime; never rendered in UI or logs.
- Data retention: configurable TTL for chat transcripts and caches.
- Access control: reuse existing app auth; feature routes honor user/session permissions.

# Development Roadmap

**MVP (Scope)**
- Session‑aware chat with streaming and tools (`get_session`).
- One‑click summary on session page.
- Local‑first provider with health check and cloud fallback.
- Minimal search using embeddings or, if unavailable, keyword fallback.
- Admin/Health indicator.
**Acceptance criteria (BDD)**
Given the app running with local provider
When a user opens a session and uses Chat and Summarize
Then tokens stream and answers reference session artifacts
And if local provider fails, cloud fallback is used automatically

**Post‑MVP Enhancements**
- Full semantic search with vector store and chunked ingestion.
- Reranking pass after retrieval.
- Conversation memory persistence across tabs/sessions.
- Observability dashboards and redaction on logs.
- Export: copy/share summaries and search results.
**Acceptance criteria (BDD)**
Given an indexed corpus
When a user searches
Then results are vector‑ranked and optionally reranked; top results include snippets and scores

# Logical Dependency Chain

1. Foundations: Provider configuration, health checks, structured logging.
2. Visible UX: Chat route + UI with SSE streaming.
3. Grounding: Tools (`get_session`) and minimal memory store.
4. Summarization: Button + route + caching.
5. Search v1: Keyword search fallback path.
6. Embeddings ingestion and vector store integration.
7. Reranking and advanced ranking features.
8. Admin panel, export features, and observability polish.

# Risks and Mitigations

- **Model/hardware mismatch**
  - Likelihood: Medium; Impact: High
  - Mitigation: Start with small models; document recommended specs; allow model id override.
- **SSE blocked by proxies**
  - Likelihood: Medium; Impact: Medium
  - Mitigation: Implement incremental fetch fallback; surface warning in UI.
- **Vector extension/version gaps**
  - Likelihood: Medium; Impact: Medium
  - Mitigation: Gate vector features behind health check; provide keyword fallback; add migration notes.
- **Privacy leakage via logs**
  - Likelihood: Low; Impact: High
  - Mitigation: Default to redact content; configurable sampling for debugging; never log secrets.
- **Provider API drift (endpoint nuances)**
  - Likelihood: Low; Impact: Medium
  - Mitigation: Centralize provider adapter; e2e contract tests against the compatible API; admin health checks.
- **Hallucinations / ungrounded answers**
  - Likelihood: Medium; Impact: Medium
  - Mitigation: Mandatory tool grounding for session facts; UI badges for grounded vs. ungrounded content.
- **Operational complexity**
  - Likelihood: Medium; Impact: Medium
  - Mitigation: Single‑command dev scripts; health page; documentation.

# Appendix

**Assumptions**
- The existing app is Next.js with a session detail page and a place to mount a Chat tab.
- Local provider exposes OpenAI‑compatible endpoints for chat, embeddings, and reranking.
- Vector store may not be available in MVP; keyword fallback acceptable.
- Team agrees to environment‑driven configuration for provider and models.
- Users have permission to read the sessions they query.

**Research findings (from provided README content only)**
- Local server defaults and OpenAI‑compatible endpoints validated for chat, embeddings, and reranking.
- Mastra supports agents, tools, memory, and Next.js integration with streaming.
- AI SDK allows a custom base URL and key for OpenAI‑compatible providers.
- Vector search operators support common distance metrics; reranking endpoint improves ordering.
- SSE requires specific headers and works with Next.js route handlers.

**Context notes (from README links; visible texts only)**
- REST API — Nexa endpoints and defaults
- nexa‑sdk — OpenAI‑compatible server and streaming
- Integrate Mastra in your Next.js project — framework integration
- Memory with LibSQL — lightweight memory store
- createTool() — define typed tools
- Agent Overview — agents with tools and memory
- OpenAI Provider — base URL and key configuration
- Vercel AI SDK · Cloudflare AI Gateway — baseURL example pattern
- Custom OpenAI‑compatible providers — provider customization
- pgvector (GitHub) — vector search capabilities
- pgvector Deep Dive — operators and usage
- Neon pgvector docs — enabling extension and queries
- Using server‑sent events (SSE) — headers and stream format
- route.js (route.ts) — Next.js route handlers
- SSE for LLM responses in Next.js — community streaming example

**Technical specifications and glossary**
- **Agent**: Orchestrates tools/memory to produce answers.
- **Tool**: Typed function callable by the agent (e.g., `get_session`).
- **Embedding**: Vector representation of text used for similarity search.
- **Reranking**: Model that scores candidates relative to a query to reorder results.
- **SSE**: Server‑Sent Events; HTTP streaming of text events.
- **Vector store**: Database or extension storing vectors and supporting similarity queries.
- **Grounding**: Citing sources or tool outputs used to produce an answer.

