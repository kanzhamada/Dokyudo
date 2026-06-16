# Dokyudo — Complete Project Execution Plan
> Solo Developer Edition | Agile/Scrum Adapted | MVP-First Approach

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Product Breakdown Structure](#2-product-breakdown-structure)
3. [Sprint Planning](#3-sprint-planning)
4. [UI/UX Phase](#4-uiux-phase)
5. [Technical Architecture Planning](#5-technical-architecture-planning)
6. [Development Roadmap](#6-development-roadmap)
7. [Testing Strategy](#7-testing-strategy)
8. [Release Plan](#8-release-plan)
9. [Risk Management](#9-risk-management)
10. [Project Timeline](#10-project-timeline)
11. [Production Readiness Checklist](#11-production-readiness-checklist)
12. [Post-Launch Plan](#12-post-launch-plan)

---

## 1. Project Overview

### Product Summary

**Dokyudo** is a SaaS platform that enables users to upload documents (PDF, DOCX, TXT), then search and ask questions about their content semantically. Built with **SvelteKit** (frontend) and **Deno + Hono** (backend), it demonstrates modern distributed system patterns: multi-tenancy, RAG-based Q&A, hybrid vector/full-text search, job queues, webhooks, feature flags, circuit breakers, and observability — all in one integrated product.

### Core Problem Being Solved

Knowledge workers spend excessive time manually searching through large document collections. Existing tools either lack semantic understanding (keyword search) or require expensive enterprise subscriptions (AI document platforms). Dokyudo provides affordable, accurate, contextual document Q&A powered by retrieval-augmented generation.

### Target Users

- **Primary:** Researchers, analysts, legal professionals, consultants who manage large document collections.
- **Secondary:** Developers and technical teams evaluating modern distributed system patterns via a working reference implementation.
- **Admin:** Platform operator managing tenants, quotas, flags, and system health.

### Main Business Goals

1. Deliver a fully functional semantic document search and Q&A SaaS platform.
2. Demonstrate production-grade distributed system patterns (queue, circuit breaker, webhook, feature flags).
3. Ship an MVP within 12 sprints (12 weeks) for initial user validation.
4. Establish a foundation for monetization via tiered subscriptions (Free / Pro).

### Success Metrics (KPIs)

| Metric | MVP Target | 3-Month Target |
|--------|-----------|----------------|
| Registered tenants | 10 | 100 |
| Documents ingested | 50 | 1,000 |
| Hybrid search P95 latency | < 700ms | < 500ms |
| RAG first-token P95 latency | < 3s | < 2s |
| Webhook delivery success rate | > 95% | > 99% |
| Job queue DLQ rate | < 2% | < 0.5% |
| Uptime | 99% | 99.5% |

### Scope Definition (In-Scope)

- Multi-tenant user registration and authentication (JWT + Redis session)
- OAuth social login (Google + GitHub): authorization redirect, state/CSRF validation, provider account linking, JWT issuance on callback
- Document upload via presigned URL (PDF, DOCX, TXT — max 25 MB)
- Ingestion pipeline: extract → chunk → embed → pgvector upsert
- Full-text search (Phase 1) + hybrid semantic search with RRF (Phase 2)
- RAG Q&A with SSE streaming
- API Gateway: auth, rate limiting, feature flag enforcement
- Distributed job queue with retry and DLQ (Supabase pg_cron + Redis)
- Webhook delivery with HMAC signing, idempotency, exponential backoff
- Feature Flag Service (CRUD, Redis cache, admin flush)
- Email notifications via job queue
- Activity feed with cursor-based pagination (90-day retention)
- AI API Gateway: multi-provider routing + circuit breaker per provider
- Admin dashboard: tenant management, metrics, webhook logs, feature flags
- Circuit breakers on all external dependencies
- Observability: structured JSON logs, /health endpoints, metrics aggregation
- Docker Compose for local dev; Deno Deploy + Vercel for production

### Out-of-Scope (MVP)

- Multi-user tenants (MVP: 1 user = 1 tenant)
- Billing / payment processing
- URL shortener feature
- Mobile native apps
- Real-time collaborative editing
- Custom embedding model fine-tuning
- SAML/SSO enterprise auth
- File versioning / document history

---

## 2. Product Breakdown Structure

### Epics

| # | Epic Name | Business Value | Priority |
|---|-----------|---------------|----------|
| E1 | Multi-Tenant Auth, OAuth & Session | Core security and user isolation | Critical |
| E2 | Document Ingestion Pipeline | Core product functionality — no ingestion = no search | Critical |
| E3 | Full-Text Search (Phase 1) | MVP search capability | Critical |
| E4 | Hybrid Semantic Search (Phase 2) | Key differentiator — semantic understanding | Critical |
| E5 | RAG Q&A with Streaming | Primary value proposition for paid tier | Critical |
| E6 | API Gateway & Rate Limiting | Infrastructure backbone; enforces all policies | Critical |
| E7 | Distributed Job Queue & Workers | Enables async processing at scale | High |
| E8 | Webhook Delivery System | Enterprise integration capability | High |
| E9 | Feature Flag Service | Dynamic rollout and tenant-level control | High |
| E10 | AI API Gateway | Provider resilience and cost optimization | High |
| E11 | Notification System | User experience and engagement | Medium |
| E12 | Activity Feed & Metrics | Retention and admin observability | Medium |
| E13 | Admin Dashboard (Svelte) | Operations and tenant management | Medium |
| E14 | Observability & Production Hardening | Production reliability | High |

---

### Features

#### E1 — Multi-Tenant Auth & Session

| Feature | Description | Dependencies | Complexity |
|---------|-------------|-------------|------------|
| F1.1 User Registration | Tenant registration with email/password (bcrypt), 1:1 user-tenant mapping | PostgreSQL | S |
| F1.2 JWT Login | Issue 15-min JWT on valid credentials | Redis, PostgreSQL | S |
| F1.3 Redis Session Store | Store refresh token reference with 24h TTL; silent JWT refresh on expiry | Redis | M |
| F1.4 Logout / Revocation | Delete Redis session entry to immediately invalidate access | Redis | XS |
| F1.5 Tenant Context Injection | Gateway middleware that reads JWT, injects `tenant_id` into request context | F1.2 | S |
| F1.6 OAuth — Google | `GET /api/auth/oauth/google` + callback; OpenID Connect PKCE flow; `state` stored in Redis (5 min TTL); on success upsert user+tenant and issue Dokyudo JWT | Redis, PostgreSQL | M |
| F1.7 OAuth — GitHub | `GET /api/auth/oauth/github` + callback; GitHub OAuth App flow; same state/CSRF and upsert pattern as F1.6 | Redis, PostgreSQL | M |
| F1.8 Provider Account Linking | If OAuth email matches existing email/password account, link provider; `oauth_providers` table stores `(user_id, provider, provider_user_id)` | PostgreSQL | S |

#### E2 — Document Ingestion Pipeline

| Feature | Description | Dependencies | Complexity |
|---------|-------------|-------------|------------|
| F2.1 Presigned URL Generation | Generate Supabase Storage S3 presigned PUT URL for direct client upload | Supabase Storage S3 | S |
| F2.2 Document Metadata Persistence | Accept POST after upload; store doc metadata; enqueue job | PostgreSQL, Supabase pg_cron | S |
| F2.3 Embedding Worker | Download file, extract text, sliding-window chunk (512 tok, 10-20% overlap), embed, upsert to pgvector | Supabase Storage S3, Embedding API, pgvector | XL |
| F2.4 Status Tracking | Update document status: pending → processing → ready / failed | PostgreSQL | S |
| F2.5 DLQ Handling | After 3 retries, move job to DLQ with last error | Supabase pg_cron | M |

#### E3 — Full-Text Search

| Feature | Description | Dependencies | Complexity |
|---------|-------------|-------------|------------|
| F3.1 tsvector Indexing | Index chunk text via PostgreSQL `tsvector` during ingestion | PostgreSQL | S |
| F3.2 Full-Text Search Endpoint | `POST /api/search` with tenant-safe `to_tsquery` filtering | F1.5, F3.1 | M |
| F3.3 Result Pagination | Offset/cursor-based result pagination | F3.2 | S |

#### E4 — Hybrid Semantic Search

| Feature | Description | Dependencies | Complexity |
|---------|-------------|-------------|------------|
| F4.1 pgvector Integration | Install pgvector extension; add embedding column to chunks table | PostgreSQL | S |
| F4.2 Query Embedding | Embed search query via Gemini or Ollama | Embedding API | S |
| F4.3 Vector Search | `ORDER BY embedding <=> $query LIMIT n WHERE tenant_id=$1` | F4.1, F4.2 | M |
| F4.4 Hybrid RRF Merge | Merge vector + full-text results using Reciprocal Rank Fusion | F3.2, F4.3 | M |
| F4.5 Circuit Breaker on pgvector | Wrap pgvector calls with circuit breaker; degrade to full-text on open | F4.3 | M |
| F4.6 Re-queue Migration Script | One-time script to embed Phase 1 documents | F2.3 | S |

#### E5 — RAG Q&A

| Feature | Description | Dependencies | Complexity |
|---------|-------------|-------------|------------|
| F5.1 Chat Endpoint (SSE) | `POST /api/chat`; stream LLM tokens via SSE | F4.4, AI Gateway | L |
| F5.2 Prompt Builder | Assemble system prompt + top-K chunk context | F4.4 | M |
| F5.3 Conversation History | Persist `conversations` and `conversation_turns` to DB | PostgreSQL | M |
| F5.4 Feature Flag Gate | `rag_enabled` flag enforcement at API Gateway | E9, F6.4 | S |
| F5.5 Multi-turn Conversation | Accept optional `conversation_id` to continue a thread | F5.3 | M |

#### E6 — API Gateway & Rate Limiting

| Feature | Description | Dependencies | Complexity |
|---------|-------------|-------------|------------|
| F6.1 Hono Gateway Bootstrap | Single entry point; route forwarding to services | Hono, Deno | M |
| F6.2 Auth Middleware | Validate JWT; silent refresh via Redis session | F1.2, F1.3 | M |
| F6.3 Sliding Window Rate Limiter | Redis-based per `tenant_id`/endpoint; return 429 on exceed | Redis | M |
| F6.4 Feature Flag Enforcement Middleware | Check flag cache; return 403 FEATURE_DISABLED if off | E9 | S |
| F6.5 Error Response Standardization | Uniform JSON error envelope across all routes | — | S |
| F6.6 /health Endpoints | Each service exposes health check | — | XS |

#### E7 — Distributed Job Queue & Workers

| Feature | Description | Dependencies | Complexity |
|---------|-------------|-------------|------------|
| F7.1 Supabase pg_cron Setup | Configure Supabase pg_cron on Redis; define queue names | Redis | S |
| F7.2 Embedding Worker | Consumer for ingestion jobs (see F2.3) | Supabase pg_cron | XL |
| F7.3 Dead Letter Queue | Capture failed jobs after max retries | Supabase pg_cron | M |
| F7.4 Job Retry Logic | Automatic retry up to 3× with backoff | Supabase pg_cron | S |

#### E8 — Webhook Delivery System

| Feature | Description | Dependencies | Complexity |
|---------|-------------|-------------|------------|
| F8.1 Webhook URL Registration | Tenant CRUD for webhook URL via API | PostgreSQL | S |
| F8.2 Webhook Worker | Consume `document.ready` event; sign + deliver POST | Supabase pg_cron, HMAC | L |
| F8.3 Idempotency Key | SHA-256 key per `event+docId+tenantId+attempt` | F8.2 | S |
| F8.4 Exponential Backoff Retry | Up to 5 delivery attempts with backoff | F8.2 | M |
| F8.5 Delivery Log | `webhook_logs` table with all attempt details | PostgreSQL | S |
| F8.6 Per-URL Circuit Breaker | Halt delivery temporarily after consecutive failures | F8.2 | M |

#### E9 — Feature Flag Service

| Feature | Description | Dependencies | Complexity |
|---------|-------------|-------------|------------|
| F9.1 Flag CRUD | Admin API to create/update/delete flags | PostgreSQL | S |
| F9.2 Flag Evaluation API | `GET /internal/features/:flagName?tenant_id=` | F9.1 | S |
| F9.3 Redis Caching (30s TTL) | Cache flag values per `(flagName, tenantId)` | Redis | S |
| F9.4 Admin Cache Flush | API to flush specific flag cache entry | Redis | XS |

#### E10 — AI API Gateway

| Feature | Description | Dependencies | Complexity |
|---------|-------------|-------------|------------|
| F10.1 Separate Deno HTTP Service | Standalone service: `POST /v1/chat/completions` | Deno | M |
| F10.2 Multi-Provider Routing | Gemini → Ollama fallback chain | LLM APIs | L |
| F10.3 Circuit Breaker per Provider | Open/half-open/closed per LLM provider | F10.2 | M |
| F10.4 Structured Request Logging | Log latency, token usage, provider, status to stdout | F10.1 | S |

#### E11 — Notification System

| Feature | Description | Dependencies | Complexity |
|---------|-------------|-------------|------------|
| F11.1 Notification Worker | Consume job; send email via SendGrid/Mailgun | Supabase pg_cron, Email API | M |
| F11.2 Email Templates | "Document ready" email template | F11.1 | S |
| F11.3 Failed Delivery DLQ | Failed email jobs routed to DLQ | Supabase pg_cron | S |

#### E12 — Activity Feed & Metrics

| Feature | Description | Dependencies | Complexity |
|---------|-------------|-------------|------------|
| F12.1 Activity Log Writes | Insert activity_log row on every key action | PostgreSQL | S |
| F12.2 Activity Feed API | `GET /api/activities` with cursor-based pagination | F12.1 | M |
| F12.3 90-Day Retention Cron | Scheduled job to purge old activity entries | Supabase pg_cron/cron | M |
| F12.4 Metrics Aggregation | Counters and latency histograms per service | PostgreSQL | M |
| F12.5 Metrics API | Expose aggregated data for admin dashboard | F12.4 | S |

#### E13 — Admin Dashboard

| Feature | Description | Dependencies | Complexity |
|---------|-------------|-------------|------------|
| F13.1 Tenant Management UI | List, disable, change quotas for tenants | E1, F12 | M |
| F13.2 Feature Flag UI | Create/edit/delete flags, flush cache | E9 | M |
| F13.3 Webhook Delivery Log Viewer | Browse webhook attempt history | E8 | S |
| F13.4 Metrics Charts | Simple charts for request/search/Q&A/webhook counters | F12.5 | M |

#### E14 — Observability & Hardening

| Feature | Description | Dependencies | Complexity |
|---------|-------------|-------------|------------|
| F14.1 Structured JSON Logging | Consistent log format across all services | — | S |
| F14.2 Grafana Loki Integration | Optional log aggregation pipeline | F14.1 | M |
| F14.3 Error Response Standardization | All services use standard error envelope | — | S |
| F14.4 Connection Pooling (PgBouncer) | Enforce max 100 PostgreSQL connections | PostgreSQL | M |
| F14.5 Scalability & Load Testing | k6 load tests; tune connection pools and caching | All | L |

---

### User Stories

#### F1.1 User Registration
- **Story:** As a new user, I want to register with my email and password so I can access the platform as an isolated tenant.
- **Acceptance Criteria:**
  - POST /api/auth/register accepts `{email, password}`.
  - Password is hashed with bcrypt (min cost 12).
  - A tenant record is created alongside the user record (1:1).
  - Returns 201 with `{userId, tenantId}`.
  - Returns 409 if email already registered.
- **Definition of Done:** Unit test passes; integration test confirms DB records created; API documented.

#### F1.2 JWT Login
- **Story:** As a registered user, I want to log in and receive a JWT so I can make authenticated API requests.
- **Acceptance Criteria:**
  - POST /api/auth/login accepts `{email, password}`.
  - Returns `{accessToken (15min), refreshToken}` on success.
  - Refresh token reference stored in Redis with 24h TTL.
  - Returns 401 on invalid credentials.
- **Definition of Done:** Auth flow tested end-to-end; token expiry verified.

#### F1.6 OAuth — Google Login
- **Story:** As a user, I want to sign in with my Google account so I can access Dokyudo without creating a separate password.
- **Acceptance Criteria:**
  - `GET /api/auth/oauth/google` returns a redirect to Google’s authorization endpoint with `client_id`, `redirect_uri`, `scope=openid email profile`, and a random `state`.
  - `state` is stored in Redis with a 5-minute TTL; on callback, it is validated before proceeding.
  - On successful callback, the authorization `code` is exchanged for tokens; user profile (email, name) is fetched from Google’s userinfo endpoint.
  - If the email already exists (email/password account), the Google provider is linked to that user. Otherwise a new user + tenant record is created.
  - Dokyudo JWT (15 min) + Redis refresh session (24 h) are issued; browser is redirected to `/app/dashboard`.
  - Returns 401 if `state` is invalid or expired.
- **Definition of Done:** Full OAuth flow tested against a real Google OAuth App (dev credentials); account-linking path tested; Redis state expiry verified.

#### F1.7 OAuth — GitHub Login
- **Story:** As a developer user, I want to sign in with my GitHub account so I can access Dokyudo quickly.
- **Acceptance Criteria:**
  - `GET /api/auth/oauth/github` redirects to GitHub’s authorization endpoint with `scope=read:user user:email`.
  - Same `state`/CSRF and upsert pattern as F1.6.
  - GitHub primary verified email is used; if no public email, the first verified email from `GET /user/emails` is used.
  - Dokyudo JWT + Redis session issued on success; redirect to `/app/dashboard`.
- **Definition of Done:** Full OAuth flow tested with a real GitHub OAuth App; email-fallback path covered by integration test.

#### F2.3 Embedding Worker
- **Story:** As the system, I want to automatically process uploaded documents into searchable vector chunks so users can search them semantically.
- **Acceptance Criteria:**
  - Worker consumes job from Supabase pg_cron queue.
  - Downloads file from Supabase Storage S3; extracts text from PDF/DOCX/TXT.
  - Chunks using sliding-window (512 tokens, 10-20% overlap).
  - Calls embedding API; upserts chunk+embedding into pgvector.
  - Updates document status to `ready`.
  - Publishes `document.ready` event.
  - Retries up to 3× on failure; moves to DLQ on exhaustion.
- **Definition of Done:** Integration test with a real PDF; upsert idempotency verified; DLQ confirmed on forced failure.

#### F3.2 Full-Text Search Endpoint
- **Story:** As a tenant user, I want to search my documents by keyword so I can find relevant content quickly.
- **Acceptance Criteria:**
  - POST /api/search `{query}` returns array of matching chunks with snippet.
  - Results are scoped to the authenticated tenant only.
  - Response includes `chunkId`, `docId`, `snippet`, `score`.
  - Rate-limited per tenant.
- **Definition of Done:** Cross-tenant isolation verified via test; rate limit enforced.

#### F4.4 Hybrid RRF Merge
- **Story:** As a tenant user, I want semantic search to combine keyword and vector results so I get the most relevant documents even if my query wording doesn't exactly match the document.
- **Acceptance Criteria:**
  - Both vector and full-text result sets are pre-filtered by `tenant_id`.
  - RRF scores merge both lists correctly.
  - Degenerate case (embedding API down) falls back to full-text only.
- **Definition of Done:** RRF logic unit-tested; degradation path tested.

#### F5.1 Chat Endpoint (SSE)
- **Story:** As a tenant user, I want to ask questions about my documents and receive a streamed AI-generated answer so I get fast, contextual responses.
- **Acceptance Criteria:**
  - POST /api/chat `{question, conversation_id?}` returns SSE stream.
  - `rag_enabled` feature flag must be active for tenant; 403 if not.
  - First SSE event arrives within 3 seconds at P95.
  - Conversation turn saved to DB after stream completes.
- **Definition of Done:** SSE streaming verified in browser; conversation_id continuity tested; feature flag gate tested.

#### F6.3 Sliding Window Rate Limiter
- **Story:** As the platform, I want to rate-limit API calls per tenant and endpoint so I can prevent abuse and ensure fair usage.
- **Acceptance Criteria:**
  - Uses Redis sliding window counter per `tenantId:endpoint`.
  - Returns 429 with `{error: {code: "RATE_LIMIT_EXCEEDED", retryAfter}}` on exceed.
  - Limits are configurable per tier.
- **Definition of Done:** Burst test confirms 429 returned at correct threshold.

#### F8.2 Webhook Worker
- **Story:** As a tenant developer, I want to receive a webhook notification when my document is ready so I can trigger downstream workflows automatically.
- **Acceptance Criteria:**
  - Worker consumes `document.ready` event.
  - Signs payload with HMAC-SHA256 using tenant secret in `X-Signature` header.
  - Idempotency key included in `X-Idempotency-Key` header.
  - Retries up to 5× with exponential backoff.
  - All attempts logged in `webhook_logs`.
  - Per-URL circuit breaker halts delivery after threshold failures.
- **Definition of Done:** HMAC verification test passes; retry logic confirmed; circuit breaker opens on simulated failures.

---

## 3. Sprint Planning

> **Sprint duration:** 1 week | **Capacity:** ~35 effective hours/sprint (solo developer)
> **Phases:** Phase 1 (Sprints 1-5), Phase 2 (Sprints 6-9), Phase 3 (Sprints 10-12), Phase 4 (Sprints 13-16)

---

### Sprint 1 — Discovery, Architecture & Environment Setup

#### Goal
Establish the technical foundation: monorepo, Supabase local development, database schema draft, and architecture decisions documented.

#### Tasks
- Initialize Deno monorepo with `deno.jsonc` workspace configuration
- Set up `apps/`: gateway, ingestion, search, rag, ai-gateway, workers, shared, frontend, admin
- Configure Docker Compose: Supabase (PostgreSQL + pgvector), Redis, Supabase Storage S3, Ollama (optional)
- Draft complete PostgreSQL schema: tenants, users, documents, chunks, conversations, conversation_turns, activity_log, webhook_logs, feature_flags, metrics
- Set up Drizzle ORM with schema files and migration tooling
- Configure ESLint, Prettier, TypeScript strict mode across workspace
- Set up Git repository with branch strategy (main, develop, feature/*)
- Write ADRs (Architecture Decision Records) for key choices: Deno vs Node, Supabase pg_cron vs Supabase pg_cron, pgvector vs dedicated vector DB
- Configure `.env.example` with all required environment variables
- Validate Docker Compose stack runs end-to-end

#### Deliverables
- Working Docker Compose environment
- Drizzle schema file with initial migration applied
- Monorepo structure with package boundaries defined
- ADR documents (3 minimum)
- `.env.example` fully documented

#### Estimated Effort
- Docker Compose + tooling: 8h
- Schema design + Drizzle setup: 10h
- Monorepo config + linting: 5h
- ADRs + documentation: 4h
- Buffer: 3h
- **Total: ~30h**

#### Dependencies
- Domain name registered (optional at this stage)
- Gemini API key available for embedding tests

#### Risks
- pgvector Docker image compatibility issues → mitigate: pin exact version `ankane/pgvector`
- Deno + Supabase pg_cron compatibility issues → mitigate: test `npm:bullmq` on Deno 2.1+ early

#### Expected Outcome
A fully functional local development environment where all services can be started with `docker-compose up`. Schema migrated. Developer can run `deno task dev` from any package.

---

### Sprint 2 — Auth, Session, and Tenant Foundation

#### Goal
Implement multi-tenant registration, JWT login, Redis session store, and logout/revocation.

#### Tasks
- Build `POST /api/auth/register` — bcrypt hash, user + tenant record creation
- Build `POST /api/auth/login` — credential validation, JWT issuance (15min), refresh token in Redis (24h TTL)
- Build `POST /api/auth/refresh` — silent JWT renewal via Redis session
- Build `POST /api/auth/logout` — delete Redis session entry
- Implement JWT validation middleware for Hono gateway
- Implement tenant context injection middleware
- Build `GET /api/me` — return authenticated user + tenant info
- **OAuth — Google:** configure Google OAuth App (dev credentials); implement `GET /api/auth/oauth/google` redirect + `GET /api/auth/oauth/google/callback` (state validation, code exchange, userinfo fetch, user upsert, JWT issuance)
- **OAuth — GitHub:** configure GitHub OAuth App (dev credentials); implement `GET /api/auth/oauth/github` redirect + `GET /api/auth/oauth/github/callback` (same pattern; handle email fetch from `/user/emails`)
- Create `oauth_providers` table migration: `(id, user_id, provider, provider_user_id, created_at)`
- Implement provider account-linking logic (email match on existing user)
- Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OAUTH_REDIRECT_BASE_URL` to `.env.example`
- Write unit tests for auth logic (bcrypt, JWT sign/verify)
- Write unit tests for OAuth state generation and validation
- Write integration tests for full auth flow (email/password + both OAuth providers)

#### Deliverables
- Auth API endpoints (register, login, refresh, logout)
- **OAuth endpoints for Google and GitHub** (redirect + callback)
- `oauth_providers` table and account-linking logic
- JWT + Redis session middleware
- Tenant context middleware
- Integration test suite for auth flow (email/password + OAuth)
- Postman/Bruno collection for auth endpoints (including OAuth redirect URLs)

#### Estimated Effort
- Auth endpoints: 10h
- Middleware (JWT, session, tenant): 8h
- **OAuth (Google + GitHub) implementation: 8h**
- `oauth_providers` table + linking logic: 2h
- Tests: 8h
- Documentation: 3h
- **Total: ~39h** *(consider extending sprint or trimming lower-priority tasks)*

#### Dependencies
- Sprint 1 complete (schema, Redis, PostgreSQL running)

#### Risks
- JWT refresh race condition (concurrent requests) → mitigate: use Redis SET NX for atomic session writes
- bcrypt performance under load → mitigate: use cost factor 12, test throughput
- OAuth `state` CSRF abuse → mitigate: Redis TTL (5 min) + single-use delete after validation
- GitHub email privacy (users with hidden email) → mitigate: fall back to `GET /user/emails` for first verified email
- Google OAuth consent screen in testing mode limits to 100 users → note in docs; publish app before beta

#### Expected Outcome
Fully working auth system. Users can register, log in, make authenticated requests, and log out with immediate session invalidation. Tests pass.

---

### Sprint 3 — Document Upload, Ingestion (Phase 1), and Full-Text Search

#### Goal
Enable document upload via presigned URL, basic text extraction + storage, and full-text keyword search.

#### Tasks
- Build presigned URL endpoint: `GET /api/documents/presigned`
- Build document metadata endpoint: `POST /api/documents`
- Integrate Supabase Storage S3 client (presigned PUT URL generation)
- Implement text extraction for PDF (pdf-parse / pdfjs), DOCX (mammoth), TXT (raw read)
- Implement Phase 1 chunking: raw text split by paragraph (no embeddings yet)
- Store chunks with `tsvector` column for full-text indexing
- Enqueue Supabase pg_cron job after metadata creation
- Build Phase 1 worker: download → extract → chunk → store (no embeddings)
- Update document status: `pending → processing → ready`
- Build `POST /api/search` (full-text only, tenant-safe)
- Build `GET /api/documents` (list tenant's documents with status)
- Build `GET /api/documents/:id` (document detail + chunks)

#### Deliverables
- Upload flow working end-to-end (presigned URL → Supabase Storage S3 → worker → search)
- Full-text search returning results filtered by `tenant_id`
- Supabase pg_cron worker running as separate Deno process
- API endpoints: presigned, POST documents, GET documents, POST search

#### Estimated Effort
- Presigned URL + Supabase Storage S3: 5h
- Text extraction (PDF/DOCX/TXT): 8h
- Chunking + DB storage: 5h
- Supabase pg_cron setup + worker: 6h
- Full-text search endpoint: 5h
- Tests: 5h
- **Total: ~34h**

#### Dependencies
- Sprint 2 complete (auth middleware works)
- Supabase Storage S3 running in Docker Compose
- Supabase pg_cron tested on Deno 2.x

#### Risks
- PDF extraction libraries in Deno — npm compatibility may be inconsistent → mitigate: test pdf-parse and pdfjs early; fallback to spawning `pdftotext` as subprocess
- File size validation (25 MB max) must be enforced at presigned URL level

#### Expected Outcome
A user can upload a PDF, the system processes it asynchronously, and they can search the content with keyword search. Phase 1 MVP search is functional.

---

### Sprint 4 — Rate Limiting, Quota Enforcement, and Error Standardization

#### Goal
Add production-grade rate limiting, quota enforcement, and standardized error responses across all endpoints.

#### Tasks
- Implement sliding window rate limiter middleware (Redis-based, per `tenantId:endpoint`)
- Integrate rate limiter into Hono gateway middleware chain
- Implement quota tracking: `uploads_used`, `searches_used`, `qa_used`, `storage_used` per tenant
- Add quota check middleware (return 429 `QUOTA_EXCEEDED` on exceed)
- Implement standard error response envelope: `{error: {code, message, retryAfter?, requestId}}`
- Apply error standardization across all existing endpoints
- Add `GET /api/quota` endpoint (return current usage vs limits)
- Add quota increment on successful upload, search, Q&A
- Set up `/health` endpoint on API gateway and worker service
- Write tests for rate limiter (burst test, sliding window behavior)
- Write tests for quota enforcement (exceed upload limit)

#### Deliverables
- Rate limiter middleware (tested)
- Quota enforcement middleware (tested)
- Standard error envelope across all endpoints
- `/health` and `/api/quota` endpoints
- Rate limiter test suite

#### Estimated Effort
- Rate limiter: 8h
- Quota system: 8h
- Error standardization: 4h
- Tests: 8h
- **Total: ~28h**

#### Dependencies
- Sprint 3 complete (search endpoint exists)
- Redis available and stable

#### Risks
- Redis unavailability bypasses rate limiting → mitigate: fail-open with log alert (rate limiting is best-effort in dev; fail-closed in production)

#### Expected Outcome
All endpoints protected by rate limiting and quota enforcement. 429 errors returned correctly with `retryAfter`. Standard error envelope consistent everywhere.

---

### Sprint 5 — SvelteKit Frontend MVP (Auth + Upload + Search UI)

#### Goal
Build a functional SvelteKit frontend covering auth, document upload, and full-text search. Phase 1 UI MVP.

#### Tasks
- Scaffold SvelteKit app with TailwindCSS and shadcn-svelte
- Configure SSR + CSR routing (`/app/*` tenant UI, `/admin/*` admin UI)
- Build auth pages: `/login`, `/register`
- Add **"Continue with Google"** and **"Continue with GitHub"** OAuth buttons to `/login` and `/register` pages (initiate redirect to `/api/auth/oauth/:provider`)
- Handle OAuth callback redirect on `/app/dashboard` (token already set server-side via cookie)
- Build auth store (Svelte writable + JWT management)
- Build document list page: `/app/documents`
- Build document upload component (direct-to-Supabase Storage S3 via presigned URL with progress indicator)
- Build search page: `/app/search` (full-text, shows snippets)
- Build document detail page: `/app/documents/[id]` (status, chunk preview)
- Build API client utility (fetch wrapper with auth headers + auto-refresh)
- Handle API errors gracefully (toast notifications)
- Implement basic responsive layout (mobile-friendly)
- Add loading states and skeleton screens

#### Deliverables
- SvelteKit app running locally
- Auth flow (register/login/logout) working in browser
- Document upload with progress and status polling
- Full-text search UI returning results

#### Estimated Effort
- SvelteKit scaffold + TailwindCSS + shadcn-svelte: 4h
- Auth pages + store: 6h
- Document upload component: 6h
- Search UI: 5h
- API client + error handling: 4h
- Responsive layout: 4h
- Buffer/polish: 3h
- **Total: ~32h**

#### Dependencies
- Sprint 3 complete (API endpoints exist)
- shadcn-svelte components available

#### Risks
- shadcn-svelte version compatibility with SvelteKit 2.x → verify before sprint start
- SSR hydration issues with JWT storage (use httpOnly cookies or SvelteKit server-side session)

#### Expected Outcome
A working Phase 1 web application. Users can register, log in, upload documents, wait for processing, and search by keyword. This is the alpha-testable state.

---

### Sprint 6 — pgvector + Embedding Worker (Phase 2 Semantic Search)

#### Goal
Upgrade the ingestion pipeline to generate embeddings and store them in pgvector. Implement hybrid semantic search with RRF.

#### Tasks
- Enable pgvector extension in PostgreSQL; add `embedding vector(768)` column to chunks table
- Write and apply Drizzle migration for embedding column + HNSW index
- Implement embedding API client (Gemini `gemini-embedding-2` + Ollama fallback)
- Enable extensions: pgvector, pgmq, pg_net, pg_cron, hstore
- Create triggers to automatically queue chunks into pgmq upon insert
- Create a Supabase Edge Function to securely call the Gemini API and generate embeddings
- Configure pg_cron to asynchronously process pgmq embedding jobs via the Edge Function
- Implement native Postgres RPC function `hybrid_search` that performs full-text and vector search, fusing them with RRF
- Add circuit breaker for pgvector calls (5 failures / 10s window, 30s open)
- Implement search degradation: fall back to full-text if embedding API unavailable
- Write Phase 1→Phase 2 migration script (re-queue all existing documents for embedding)
- Update `POST /api/search` to use hybrid search by default

#### Deliverables
- pgvector migration applied
- Embedding worker producing real vector embeddings
- Hybrid search endpoint with RRF
- Circuit breaker on pgvector
- Migration script for Phase 1 documents

#### Estimated Effort
- pgvector schema + migration: 4h
- Embedding API client: 4h
- Sliding-window chunker: 6h
- Upsert + worker upgrade: 6h
- Vector search + RRF: 6h
- Circuit breaker: 4h
- Migration script + tests: 4h
- **Total: ~34h**

#### Dependencies
- Sprint 5 complete (Phase 1 working)
- Gemini API key with embedding access
- pgvector Docker image stable

#### Risks
- Token counting library in Deno — use `tiktoken` npm package; verify Deno compat
- Embedding API rate limits → mitigate: add per-chunk delay and batch embedding calls

#### Expected Outcome
Semantic search is live. A user who uploads a document and searches with natural language gets semantically relevant results, not just keyword matches.

---

### Sprint 7 — RAG Q&A Service + AI API Gateway

#### Goal
Build the RAG Q&A endpoint with SSE streaming and the AI API Gateway as a separate service with multi-provider routing and circuit breaker.

#### Tasks
- Build AI API Gateway as separate Deno HTTP service (Hono)
  - `POST /v1/chat/completions` — accepts messages array
  - Gemini → Ollama fallback chain
  - Circuit breaker per provider (defaults: 5 failures/10s, 30s open)
  - Structured request/response logging (latency, tokens, provider, status)
- Build RAG Service: `POST /api/chat`
  - Extract question, fetch top-K=5 chunks via Search Service
  - Build system prompt with context
  - Call AI API Gateway with streaming
  - Relay SSE tokens to client
  - Save conversation turn to DB (after stream complete)
  - Support optional `conversation_id` for multi-turn
- Integrate Feature Flag gate at API Gateway: `rag_enabled` returns 403 if disabled
- Add conversation endpoints: `GET /api/conversations`, `GET /api/conversations/:id`
- Write SSE streaming tests

#### Deliverables
- AI API Gateway service running
- `POST /api/chat` SSE endpoint working
- Multi-provider fallback tested
- Circuit breaker per LLM provider
- Conversation history persisted

#### Estimated Effort
- AI API Gateway service: 8h
- Multi-provider routing + circuit breaker: 6h
- RAG service + SSE: 8h
- Prompt builder + conversation DB: 5h
- Feature flag gate integration: 2h
- Tests: 5h
- **Total: ~34h**

#### Dependencies
- Sprint 6 complete (hybrid search working)
- Sprint 4 (feature flag enforcement middleware)
- Gemini API keys

#### Risks
- SSE backpressure in Deno → test with slow LLM responses
- Token limits on prompt context → implement token budget in prompt builder (max 3000 tokens of context)

#### Expected Outcome
Users can ask questions about their documents and get streamed AI answers. The AI API Gateway gracefully falls back across providers.

---

### Sprint 8 — Feature Flag Service + Webhook Delivery System

#### Goal
Build the Feature Flag Service and the full Webhook Delivery System with HMAC signing, retry, idempotency, and per-URL circuit breaker.

#### Tasks
- **Feature Flag Service:**
  - `POST /internal/features` — create/update flag
  - `GET /internal/features/:flagName?tenant_id=` — evaluate flag
  - Redis caching: 30s TTL per `(flagName, tenantId)`
  - `DELETE /internal/features/:flagName/cache` — admin cache flush
  - Store flags in PostgreSQL `feature_flags` table
- **Webhook System:**
  - `POST /api/webhooks` — register webhook URL for tenant
  - `GET /api/webhooks` — list tenant webhooks
  - `DELETE /api/webhooks/:id` — remove webhook
  - Webhook Worker: consume `document.ready`, sign with HMAC-SHA256, idempotency key, deliver POST
  - Exponential backoff retry (max 5 attempts)
  - Log all attempts to `webhook_logs`
  - Per-URL circuit breaker (same defaults as §5.13)
- Write HMAC verification test (sign + verify)
- Write idempotency key generation test
- Write circuit breaker behavior test for webhook URLs

#### Deliverables
- Feature Flag Service (CRUD + Redis cache + flush)
- Webhook registration API
- Webhook Worker with signing, retry, idempotency, circuit breaker
- `webhook_logs` table populated on each attempt

#### Estimated Effort
- Feature Flag Service: 7h
- Webhook CRUD API: 4h
- Webhook Worker + HMAC + retry: 9h
- Idempotency + circuit breaker: 5h
- Tests: 6h
- **Total: ~31h**

#### Dependencies
- Sprint 7 complete (job queue workers infrastructure)
- Supabase pg_cron event publication from embedding worker

#### Risks
- HMAC secret rotation strategy not defined → document as future work; generate per-tenant secret at registration

#### Expected Outcome
Feature flags can be toggled per tenant via admin API. Webhooks fire reliably with HMAC signing, retry backoff, and circuit breaker protection.

---

### Sprint 9 — Notification System, Activity Feed, and Admin API

#### Goal
Complete Phase 3 with email notifications, activity feed with cursor pagination, and the admin API backend.

#### Tasks
- **Notification Worker:**
  - Consume notification jobs from Supabase pg_cron
  - Send email via SendGrid (or Mailgun) using template system
  - "Document ready" email template
  - Failed deliveries to DLQ
- **Activity Feed:**
  - Instrument all key actions with `activity_log` inserts (upload, index complete, search, Q&A, webhook error)
  - `GET /api/activities` with cursor-based pagination (using `id` as cursor)
  - Retention cron job: delete entries older than 90 days (Supabase pg_cron scheduled job)
- **Metrics:**
  - Counter increments per action type per tenant
  - Latency histogram storage (P50/P95/P99 aggregates stored hourly)
  - `GET /api/admin/metrics` — aggregate metrics API
- **Admin API:**
  - `GET /api/admin/tenants` — list all tenants
  - `PATCH /api/admin/tenants/:id` — update quota / disable tenant
  - `GET /api/admin/webhook-logs` — all webhook delivery logs
  - `GET /api/admin/feature-flags` — manage flags (proxy to Feature Flag Service)

#### Deliverables
- Notification Worker (email sending tested)
- Activity feed API with cursor pagination
- Retention cron job configured
- Metrics API
- Admin REST API (tenants, webhook logs, metrics, flags)

#### Estimated Effort
- Notification Worker: 6h
- Activity feed + pagination: 6h
- Retention cron: 3h
- Metrics aggregation: 6h
- Admin API: 6h
- Tests: 5h
- **Total: ~32h**

#### Dependencies
- Sprint 8 complete
- Email provider API key (SendGrid/Mailgun)

#### Risks
- Email provider sandbox limits during development → use SendGrid sandbox mode for testing

#### Expected Outcome
Platform is feature-complete for Phase 3. Admins can manage tenants and flags. Users receive email notifications. Activity feed works with cursor pagination.

---

### Sprint 10 — SvelteKit UI Phase 2 (Semantic Search, RAG Chat, Activity)

#### Goal
Upgrade the frontend to support hybrid semantic search, the RAG chat interface with SSE streaming, and the activity feed.

#### Tasks
- Upgrade search page to show vector + hybrid results with relevance score
- Build `/app/chat` — Q&A chat interface with SSE streaming (streaming tokens rendered incrementally)
- Build conversation history UI (list and continue previous conversations)
- Build `/app/activity` — activity feed with infinite scroll (cursor-based)
- Build `/app/webhooks` — webhook URL management (register, list, delete)
- Add quota usage indicator to dashboard/nav
- Add document status page with polling (pending → ready indicator)
- Polish: empty states, error boundaries, accessibility improvements
- Keyboard navigation and screen reader labels (WCAG 2.1 AA basics)

#### Deliverables
- Hybrid search UI
- Chat interface with live token streaming
- Conversation history
- Activity feed with infinite scroll
- Webhook management UI
- Responsive, accessible layout

#### Estimated Effort
- Chat UI + SSE: 8h
- Search upgrade: 3h
- Conversation history: 4h
- Activity feed: 4h
- Webhook UI: 3h
- Quota indicator + polish: 4h
- Accessibility: 4h
- **Total: ~30h**

#### Dependencies
- Sprint 9 complete (all backend APIs exist)

#### Risks
- SSE in SvelteKit — use native `EventSource` API; handle reconnection on network drop

#### Expected Outcome
A polished, feature-rich frontend matching all Phase 1-3 backend capabilities. Beta-testable state.

---

### Sprint 11 — Admin Dashboard (SvelteKit) + Observability

#### Goal
Build the complete admin dashboard and add observability: structured logging, health checks, Grafana Loki integration.

#### Tasks
- Build separate SvelteKit admin app (`/admin/*` routes)
- Admin login page (admin-role JWT)
- Tenant management table (list, disable, quota edit)
- Feature flag management (CRUD, flush cache button)
- Webhook delivery log viewer (filterable by tenant, status)
- Metrics dashboard with charts (recharts or chart.js): request count, search/day, Q&A/day, webhook success rate
- Structured JSON logging across all Deno services (request ID, tenant ID, latency, error code)
- `/health` endpoint standardization: `{status: "ok"|"degraded", dependencies: {redis, postgres, supabase-storage}}`
- Optional: Docker Compose config for Grafana + Loki log aggregation
- Add request ID propagation across service calls (via `X-Request-ID` header)

#### Deliverables
- Admin SvelteKit app with all management UIs
- Metrics charts
- Standardized `/health` endpoints
- Structured logging across all services
- Optional Grafana + Loki stack

#### Estimated Effort
- Admin SvelteKit app: 10h
- Metrics charts: 4h
- Structured logging: 5h
- Health endpoints: 3h
- Grafana/Loki (optional): 4h
- Tests: 4h
- **Total: ~30h**

#### Dependencies
- Sprint 9 complete (admin API, metrics API exist)

#### Risks
- Admin auth isolation — ensure admin endpoints require `role=admin` claim in JWT

#### Expected Outcome
Full admin visibility and control. Operators can monitor system health, manage tenants and flags, and view webhook logs from a dedicated UI.

---

### Sprint 12 — Production Hardening, Security Audit & Pre-Launch

#### Goal
Harden the application for production: PgBouncer, connection pooling, security audit, load testing, final bug fixes, deployment to Deno Deploy.

#### Tasks
- Configure PgBouncer in transaction mode (max 100 PostgreSQL connections)
- Audit all SQL queries for proper `tenant_id` filtering (cross-tenant isolation check)
- Security audit checklist:
  - Input validation on all endpoints (Zod schemas)
  - HMAC signature verification (webhooks)
  - JWT secret rotation procedure documented
  - OAuth `state` CSRF protection verified (single-use, 5-min TTL)
  - OAuth client secrets stored only in environment variables
  - OAuth redirect URIs locked to known production origins in provider dashboards
  - CORS configuration locked to known origins
  - Secrets in environment variables only (no hardcoded)
  - Supabase Storage S3 bucket policy: private, presigned URLs only
  - Rate limit bypass check
- Load test with k6: simulate 50 concurrent users, search + chat
- Fix all P0/P1 bugs found during load test
- Deploy to Deno Deploy: API Gateway, workers, AI Gateway
- Deploy to Vercel: SvelteKit frontend, admin frontend
- Configure managed PostgreSQL (Supabase)
- Configure Upstash Redis
- Configure S3 / Cloudflare R2 for production object storage
- Configure CI/CD pipeline (GitHub Actions): lint → test → build → deploy
- Write runbook: deployment procedure, rollback procedure, incident checklist

#### Deliverables
- PgBouncer configured
- Security audit completed (checklist signed off)
- k6 load test report
- Production deployment on Deno Deploy
- CI/CD pipeline (GitHub Actions)
- Runbook document

#### Estimated Effort
- PgBouncer + connection pooling: 4h
- Security audit + fixes: 8h
- Load test + fixes: 6h
- Production deployment: 8h
- CI/CD pipeline: 4h
- Runbook: 3h
- **Total: ~33h**

#### Dependencies
- Vercel, Deno Deploy, Supabase, Upstash credentials
- Sprint 11 complete

#### Risks
- Deno Deploy cold start latency for workers → configure `min_machines_running = 1`
- Managed PostgreSQL migration from Docker → test with `pg_dump / pg_restore`

#### Expected Outcome
**Production launch ready.** Application deployed, monitored, CI/CD running. Production launch checklist complete.

---

## 4. UI/UX Phase

### Research

#### User Research
- Interview 5-10 potential users (researchers, analysts, legal professionals): how do they currently manage documents? What search tools do they use? Where do they get frustrated?
- Survey: preferred document types, frequency of use, acceptable response latency for Q&A.
- Key questions: Do users prefer chat-style Q&A or keyword search + highlights? How do they want to share search results?

#### Competitor Analysis

| Tool | Strengths | Weaknesses |
|------|-----------|------------|
| ChatPDF | Simple UX, free tier | Single-doc only, no multi-tenant |
| Notion AI | Integrated into workspace | Requires Notion adoption |
| Azure AI Search | Enterprise-grade | Complex setup, expensive |
| Perplexity | Great UX for general search | Not document-specific |
| DocuChat | Purpose-built | Limited search quality |

#### Feature Benchmarking
- Upload flow UX (drag-and-drop vs file picker vs URL import)
- Progress indicators during processing
- Search result presentation (snippets vs full text vs highlighted)
- Chat UX patterns (streaming tokens, citation linking, follow-up prompts)

---

### UX

#### User Flows

**Primary Flow — New User (email/password):**
Register → Verify Email → Upload First Document → Wait for Processing → Search → Ask Question → View Streamed Answer

**Primary Flow — New User (OAuth):**
Click "Continue with Google / GitHub" → OAuth Consent → Redirect back → Auto-registered tenant → Upload First Document → Search → Ask Question

**Secondary Flow — Returning User:**
Login → View Documents List → Select Document → Ask Follow-up Question in Conversation

**Admin Flow:**
Admin Login → View Tenant List → Disable Tenant → Toggle Feature Flag → View Webhook Logs

#### Information Architecture
```
/
├── /login
├── /register
└── /app (authenticated)
    ├── /dashboard (quota overview, recent docs)
    ├── /documents
    │   ├── [list]
    │   └── /[id] (detail, status, chunks)
    ├── /search (global hybrid search)
    ├── /chat (Q&A interface)
    │   └── /[conversation_id]
    ├── /activity (activity feed)
    └── /settings
        └── /webhooks

/admin (admin-authenticated)
├── /tenants
├── /flags
├── /webhooks/logs
└── /metrics
```

#### Journey Mapping
- **Happy path:** Register → Upload → Process completes (email received) → Search → Chat → "This is useful!"
- **Frustrated path:** Upload fails (file too large) → unclear error → no retry guidance → churn. Mitigation: Clear validation messages, file size shown before upload, retry button.
- **Admin path:** Tenant exceeds quota → admin notified via metric alert → admin increases quota from dashboard.

---

### UI

#### Design System
- **Typography:** Inter (clean, legible for dense document content)
- **Colors:** Neutral gray base (TailwindCSS slate), blue primary (#3B82F6), green success, red error
- **Spacing:** 4px base grid (Tailwind default)
- **Dark mode:** Supported via TailwindCSS dark variant + SvelteKit theme toggle
- **Brand:** Minimal, professional — doc-centric, not AI-hype aesthetic

#### Key Components
- `DocumentCard` — status badge (processing/ready/failed), file size, date, action menu
- `SearchResultItem` — doc title, snippet highlight, relevance score badge, "Ask about this" button
- `ChatMessage` — user bubble vs assistant bubble, streaming cursor animation, citation footnotes
- `UploadDropzone` — drag-and-drop, progress bar, file validation feedback
- `QuotaBar` — visual usage meter (uploads, searches, Q&A) with "Upgrade" CTA
- `FeatureFlagToggle` (admin) — on/off toggle with tenant-scope selector
- `WebhookAttemptRow` — status badge, timestamp, response code, retry count
- `MetricChart` — sparkline or bar chart for daily counts

#### Responsive Layouts
- Mobile-first: single-column layout, bottom nav for main actions
- Tablet: two-column (sidebar + content)
- Desktop: three-column (nav + content + detail panel for chat)

#### Accessibility Checklist
- [ ] All interactive elements keyboard-navigable
- [ ] ARIA labels on icon-only buttons
- [ ] Color contrast ≥ 4.5:1 for body text (WCAG 2.1 AA)
- [ ] Focus rings visible on all focusable elements
- [ ] Screen reader announcements for loading states and streaming tokens
- [ ] Alt text on all images and icons
- [ ] Error messages associated with form fields via `aria-describedby`

---

### Deliverables
- **Wireframes:** Low-fi sketches for all 12 key screens (Excalidraw or Figma)
- **Low-fidelity prototype:** Clickable flow covering register → upload → search → chat
- **High-fidelity prototype:** Figma with design tokens, component library, and key interactions
- **Design System:** Figma component library + TailwindCSS config (`tailwind.config.ts` with custom tokens)

---

## 5. Technical Architecture Planning

### Frontend

#### Framework
**SvelteKit 2.x** with SSR enabled for authenticated routes (for faster initial load and SEO-friendly marketing pages).

#### State Management
- **Auth state:** Svelte writable store, hydrated from SvelteKit server-side load function (using secure httpOnly cookies)
- **Search state:** Local component state + URL search params (shareable search URLs)
- **Chat state:** Local component state with SSE `EventSource`
- **Server-side:** SvelteKit `load()` functions for data fetching on navigation

#### Routing
SvelteKit file-system routing. Protected routes check auth in `+layout.server.ts`. Redirect to `/login` if unauthenticated.

#### Form Handling
Native SvelteKit form actions for auth pages. JavaScript-enhanced forms for upload (XHR progress). Zod for client-side validation schemas (shared with backend types).

#### Validation
Zod schemas in `lib/validation/` shared between client forms and server actions. Error messages displayed inline via `aria-describedby`.

---

### Backend

#### Architecture Pattern
**Service-oriented monorepo** — each service is a standalone Deno HTTP process (Hono). Services communicate over HTTP internally. The API Gateway is the single external entry point.

#### Example Folder Structure
```
apps/backend/
├── config/                # Environment and app configuration
├── controllers/           # Request handlers
├── middlewares/           # Authentication, error handling, CORS
├── models/                # Database schemas and types
├── routes/                # API endpoint definitions
├── services/              # Core business logic
├── utils/                 # Helpers and reusable functions
├── .env                   # Environment variables
├── .gitignore             # Git ignored files
├── deno.json              # Dependency and task management (Replaces package.json)
├── dev.ts                 # Local development entry point
└── main.ts                # Application entry point
```

#### API Structure
All public APIs follow REST conventions:
- `GET /api/resource` — list (with pagination)
- `POST /api/resource` — create
- `GET /api/resource/:id` — detail
- `PATCH /api/resource/:id` — partial update
- `DELETE /api/resource/:id` — delete
- `POST /api/chat` — SSE streaming endpoint
- `POST /api/search` — search (POST because query can be long)
- Internal: `GET /internal/features/:flag`

#### Authentication Strategy
- JWTs signed with HS256 (15-minute expiry)
- Refresh tokens stored as Redis keys: `session:{refreshTokenHash}` → `{userId, tenantId, exp}`
- On JWT expiry: gateway checks Redis; if valid session exists, issues new JWT silently
- Logout: delete Redis key → next request fails auth

#### Authorization Strategy
- Role claim in JWT: `role: "tenant" | "admin"`
- Admin routes (`/api/admin/*`, `/internal/*`) check `role === "admin"`
- Tenant data access: all queries filter by `tenant_id` from injected context
- Feature flags: gateway evaluates flag before forwarding to service

#### Error Handling
Every service wraps handlers in try/catch. Errors are converted to the standard envelope:
```json
{
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human description",
    "retryAfter": 30,
    "requestId": "uuid"
  }
}
```
`requestId` is generated at gateway and propagated via `X-Request-ID` header.

#### Logging
Structured JSON to stdout. Fields: `timestamp`, `level`, `service`, `requestId`, `tenantId`, `method`, `path`, `statusCode`, `latencyMs`, `error?`. Compatible with Grafana Loki.

---

### Database

#### Entity Design (Key Tables)

```sql
tenants(id UUID PK, name TEXT, tier TEXT, created_at)
users(id UUID PK, tenant_id UUID FK, email TEXT UNIQUE, password_hash TEXT, role TEXT, created_at)
documents(id UUID PK, tenant_id UUID FK, name TEXT, mime_type TEXT, size_bytes INT, storage_path TEXT, status TEXT, created_at, processed_at)
chunks(id UUID PK, doc_id UUID FK, tenant_id UUID FK, chunk_index INT, content TEXT, tokens INT, embedding vector(768), ts_content tsvector, created_at)
conversations(id UUID PK, tenant_id UUID FK, created_at)
conversation_turns(id UUID PK, conversation_id UUID FK, turn_index INT, question TEXT, answer TEXT, context_chunk_ids UUID[], model_used TEXT, latency_ms INT, created_at)
activity_log(id UUID PK, tenant_id UUID FK, type TEXT, metadata JSONB, created_at)
webhook_registrations(id UUID PK, tenant_id UUID FK, url TEXT, secret TEXT, active BOOL, created_at)
webhook_logs(id UUID PK, webhook_id UUID FK, tenant_id UUID FK, event_type TEXT, status TEXT, attempt INT, response_code INT, error TEXT, idempotency_key TEXT, created_at)
feature_flags(id UUID PK, name TEXT, description TEXT, global_value BOOL, created_at)
feature_flag_overrides(id UUID PK, flag_id UUID FK, tenant_id UUID FK, value BOOL)
quota_usage(tenant_id UUID PK FK, uploads_used INT, searches_used INT, qa_used INT, storage_bytes BIGINT, period_start DATE)
```

#### Relationships
- `users` → `tenants` (many-to-one; MVP: one-to-one)
- `documents` → `tenants`
- `chunks` → `documents`, `tenants`
- `conversations` → `tenants`
- `conversation_turns` → `conversations`
- `activity_log` → `tenants`
- `webhook_registrations` → `tenants`
- `webhook_logs` → `webhook_registrations`
- `feature_flag_overrides` → `feature_flags`, `tenants`

#### Indexing Strategy
```sql
-- Tenant isolation (all hot queries)
CREATE INDEX idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX idx_chunks_tenant_id ON chunks(tenant_id);
CREATE INDEX idx_chunks_doc_id ON chunks(doc_id);
CREATE INDEX idx_activity_log_tenant_created ON activity_log(tenant_id, created_at DESC);

-- Vector search (HNSW for ANN)
CREATE INDEX idx_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops);

-- Full-text search
CREATE INDEX idx_chunks_ts ON chunks USING gin(ts_content);

-- Webhook logs
CREATE INDEX idx_webhook_logs_tenant ON webhook_logs(tenant_id, created_at DESC);

-- Conversation lookups
CREATE INDEX idx_turns_conversation ON conversation_turns(conversation_id, turn_index);
```

#### Migration Strategy
- All migrations managed by Drizzle ORM (`drizzle-kit generate:pg` + `drizzle-kit migrate`)
- Migrations are code-reviewed and committed to `packages/db/migrations/`
- Migrations run automatically on deployment via a pre-start script
- Never drop columns directly — use `ALTER TABLE ... ADD COLUMN` first, then deprecate
- Phase 1→Phase 2 transition: additive migration (add `embedding` column; existing rows have `NULL` until re-processed)

---

### Infrastructure

#### Hosting

| Service | Local | Production |
|---------|-------|------------|
| API Gateway, Ingestion, Search, RAG, Feature Flags, Activity | Docker Compose | Deno Deploy |
| Embedding Worker, Webhook Worker, Notification Worker | Docker Compose process | Deno Deploy |
| AI API Gateway | Docker Compose | Deno Deploy |
| SvelteKit Frontend | `vite dev` | Vercel |
| Admin Frontend | `vite dev` | Vercel |
| Supabase (PostgreSQL + pgvector) | Docker Compose | Supabase |
| Redis | Docker Compose | Upstash |
| Object Storage | Supabase Storage S3 (local/Docker) | Supabase Storage S3 |

#### CI/CD (GitHub Actions)
```yaml
# Trigger: push to main or develop
# Steps:
1. Lint (deno lint, deno fmt --check)
2. Type check (deno check)
3. Unit tests (deno test)
4. Build SvelteKit apps
5. Integration tests (Docker Compose up → run test suite → down)
6. Deploy (main branch only):
   - Workers → Deno Deploy
   - Services → Deno Deploy
   - Frontend → Vercel
```

#### Monitoring
- `/health` endpoint on each service: checks Redis, PostgreSQL, Supabase Storage S3 connectivity
- Uptime monitoring: Better Uptime or UptimeRobot (free tier) pinging `/health`
- Error alerting: Sentry or Axiom for structured log error aggregation
- Metrics: custom PostgreSQL-backed metrics service + admin dashboard charts

#### Backup Strategy
- PostgreSQL: daily automated backups via managed provider (Supabase point-in-time recovery or RDS automated snapshots)
- Redis: persistence via AOF on Upstash; Supabase pg_cron DLQ captured in PostgreSQL for durability
- Supabase Storage S3: versioning enabled on production bucket; cross-region replication for critical data
- Code: GitHub repository (primary) + daily export to secondary location

---

## 6. Development Roadmap

### Frontend Tasks

| Task | Priority | Effort | Dependencies |
|------|----------|--------|-------------|
| SvelteKit scaffold + TailwindCSS + shadcn-svelte | Critical | 4h | — |
| Auth pages (login, register) | Critical | 5h | Auth API |
| OAuth buttons (Google + GitHub) on auth pages | Critical | 2h | OAuth API |
| Auth store (JWT, refresh) | Critical | 4h | Auth API |
| Document upload component (presigned URL + progress) | Critical | 6h | Ingestion API |
| Document list page | Critical | 3h | Documents API |
| Full-text search page | Critical | 4h | Search API (Phase 1) |
| Hybrid search upgrade | High | 3h | Search API (Phase 2) |
| RAG chat interface (SSE streaming) | Critical | 8h | RAG API |
| Conversation history UI | High | 4h | Conversations API |
| Activity feed (infinite scroll) | Medium | 4h | Activity API |
| Webhook management UI | Medium | 3h | Webhook API |
| Quota usage indicator | Medium | 2h | Quota API |
| Admin SvelteKit app scaffold | High | 4h | Admin APIs |
| Admin tenant management table | High | 4h | Admin API |
| Admin feature flag UI | High | 3h | Feature Flag API |
| Admin webhook logs viewer | Medium | 3h | Webhook logs API |
| Admin metrics charts | Medium | 4h | Metrics API |
| Accessibility polish (WCAG 2.1 AA) | High | 4h | All UI complete |
| Responsive layout (mobile/tablet/desktop) | High | 4h | All UI complete |

### Backend Tasks

| Task | Priority | Effort | Dependencies |
|------|----------|--------|-------------|
| Monorepo + Deno workspace setup | Critical | 4h | — |
| Hono API Gateway bootstrap | Critical | 3h | Deno |
| JWT auth + bcrypt (register/login) | Critical | 6h | PostgreSQL |
| OAuth — Google (redirect + callback + upsert) | Critical | 5h | Redis, PostgreSQL |
| OAuth — GitHub (redirect + callback + upsert) | Critical | 4h | Redis, PostgreSQL |
| `oauth_providers` table + account linking | Critical | 2h | PostgreSQL |
| Redis session store (refresh + revocation) | Critical | 5h | Redis |
| Tenant context middleware | Critical | 2h | Auth |
| Sliding window rate limiter | Critical | 6h | Redis |
| Quota enforcement middleware | Critical | 5h | PostgreSQL |
| Standard error response envelope | Critical | 2h | — |
| Presigned URL generation (Supabase Storage S3) | Critical | 4h | Supabase Storage S3 |
| Document metadata API | Critical | 3h | PostgreSQL |
| Text extraction (PDF/DOCX/TXT) | Critical | 6h | npm libs |
| Phase 1 chunker (paragraph split) | Critical | 3h | Text extraction |
| Full-text search endpoint | Critical | 5h | PostgreSQL tsvector |
| pgvector migration + embedding column | Critical | 3h | PostgreSQL |
| Embedding API client (Gemini + Ollama) | Critical | 4h | API keys |
| Sliding-window chunker (512 tok, overlap) | Critical | 6h | tiktoken |
| Upsert embedding worker | Critical | 5h | pgvector, Supabase pg_cron |
| Vector search + RRF merge | Critical | 6h | pgvector |
| Circuit breaker (pgvector) | High | 4h | Search Service |
| AI API Gateway (Deno HTTP service) | Critical | 6h | LLM APIs |
| Multi-provider routing + fallback | Critical | 5h | AI Gateway |
| Circuit breaker per LLM provider | High | 4h | AI Gateway |
| RAG service + SSE endpoint | Critical | 8h | Search, AI Gateway |
| Conversation history persistence | High | 4h | PostgreSQL |
| Feature Flag Service (CRUD + Redis cache) | High | 6h | PostgreSQL, Redis |
| Feature flag gateway enforcement | High | 3h | Feature Flag Service |
| Webhook registration API | High | 3h | PostgreSQL |
| Webhook Worker (HMAC, retry, idempotency) | High | 8h | Supabase pg_cron |
| Per-URL circuit breaker (webhooks) | High | 4h | Webhook Worker |
| Notification Worker (email) | Medium | 5h | Supabase pg_cron, Email API |
| Activity log writes (instrumentation) | Medium | 4h | PostgreSQL |
| Activity feed API (cursor pagination) | Medium | 4h | activity_log |
| 90-day retention cron | Medium | 3h | Supabase pg_cron scheduler |
| Metrics aggregation service | Medium | 5h | PostgreSQL |
| Admin API (tenants, flags, logs, metrics) | High | 6h | All services |
| `/health` endpoints (all services) | High | 3h | Each service |
| Structured JSON logging | High | 4h | All services |
| PgBouncer configuration | High | 3h | PostgreSQL |
| Input validation (Zod schemas) | High | 5h | All endpoints |

### Database Tasks

| Task | Priority | Effort | Dependencies |
|------|----------|--------|-------------|
| Initial schema design + Drizzle setup | Critical | 6h | PostgreSQL |
| `oauth_providers` table migration | Critical | 1h | Schema |
| Initial migration (all core tables) | Critical | 3h | Schema |
| tsvector index on chunks | Critical | 1h | Schema |
| pgvector extension + embedding column migration | Critical | 2h | pgvector |
| HNSW index on embedding column | Critical | 1h | pgvector migration |
| tenant_id indexes (all tenant-scoped tables) | Critical | 1h | Schema |
| webhook_logs table + indexes | High | 1h | Schema |
| feature_flags + overrides tables | High | 1h | Schema |
| quota_usage table | High | 1h | Schema |
| conversations + turns tables | High | 1h | Schema |

### DevOps Tasks

| Task | Priority | Effort | Dependencies |
|------|----------|--------|-------------|
| Docker Compose (postgres, redis, supabase-storage, ollama) | Critical | 4h | — |
| `.env.example` documentation (incl. OAuth client IDs/secrets) | Critical | 1h | — |
| GitHub Actions: lint + typecheck | High | 3h | — |
| GitHub Actions: unit + integration tests | High | 4h | Docker Compose |
| Deno Deploy account for workers | High | 3h | — |
| Deno Deploy setup for services + frontend | High | 3h | — |
| Managed PostgreSQL (Supabase/RDS) provisioning | High | 2h | — |
| Upstash Redis provisioning | High | 1h | — |
| S3 / Cloudflare R2 bucket setup | High | 2h | — |
| GitHub Actions: deploy to Deno Deploy + Vercel | High | 4h | All services built |
| PgBouncer setup (production) | High | 3h | PostgreSQL |
| Uptime monitoring (Better Uptime) | Medium | 1h | `/health` endpoints |
| Runbook documentation | High | 4h | Production deployed |

---

## 7. Testing Strategy

### Unit Testing

**Scope:** Pure business logic functions — JWT generation/validation, bcrypt, RRF algorithm, sliding window rate limiter logic, circuit breaker state machine, HMAC signing, chunking algorithm, idempotency key generation.

**Tools:** `deno test` (built-in), `@std/assert`

**Success Criteria:**
- Coverage ≥ 80% on all `shared/` and business logic modules
- All edge cases for RRF, sliding window, and circuit breaker state transitions covered
- Test run completes in < 30 seconds

---

### Integration Testing

**Scope:** API endpoints tested against real Docker Compose services (PostgreSQL, Redis, Supabase Storage S3). Tests cover: auth flow, document upload → worker → search pipeline, rate limiting, quota enforcement, webhook delivery, feature flag evaluation.

**Tools:** `deno test` with `docker-compose up` in CI, custom test fixtures for tenant setup/teardown.

**Success Criteria:**
- All API endpoints have at least one happy-path and one error-path integration test
- Cross-tenant data isolation verified (tenant A cannot see tenant B's data)
- Retry + DLQ behavior verified with forced failures
- Tests pass in GitHub Actions CI

---

### End-to-End Testing

**Scope:** Full user flows in a real browser: register → upload → wait for processing → search → chat → logout. Admin flows: login as admin → manage tenant → toggle flag.

**Tools:** Playwright (TypeScript)

**Success Criteria:**
- 5 critical user flows automated (register, upload, search, chat, admin flag toggle)
- Tests run in GitHub Actions on pull requests to `main`
- Zero flaky tests (retry-aware selectors, explicit waits)

---

### Security Testing

**Scope:** Authentication bypass attempts, tenant isolation (IDOR), SQL injection, XSS in document content rendering, HMAC signature tampering, JWT manipulation, rate limit bypass.

**Tools:** Manual testing checklist + `zap` (OWASP ZAP) for automated scan

**Success Criteria:**
- No OWASP Top 10 vulnerabilities found or all found issues remediated before launch
- IDOR test: authenticated tenant cannot access another tenant's documents via direct ID
- SQL injection test: parameterized queries verified via Drizzle ORM (no raw string interpolation)
- HMAC test: tampered webhook payload rejected

---

### Performance Testing

**Scope:** Hybrid search latency (P95 < 700ms), RAG first-token latency (P95 < 3s), concurrent upload + search under 50 users.

**Tools:** k6 (load testing scripts in `tests/load/`)

**Success Criteria:**
- Hybrid search P95 latency ≤ 500ms under 50 concurrent users
- RAG first-token P95 latency ≤ 3s under 20 concurrent users
- Zero 5xx errors during sustained load (10 minutes)
- Memory and CPU usage within Deno Deploy instance limits during load test

---

### User Acceptance Testing

**Scope:** 3-5 real users complete the core workflow end-to-end (upload a real document they own, search it, ask questions). Admin UAT with operator on admin dashboard.

**Tools:** Recorded screen sessions (Loom) + structured feedback form

**Success Criteria:**
- All test users successfully complete the upload → search → chat flow without assistance
- Critical UX friction points identified and documented (backlog for Sprint 12 fixes)
- Admin can create a tenant, toggle a feature flag, and view webhook logs without guidance

---

## 8. Release Plan

### Alpha Release (End of Sprint 5)

**Features Included:**
- User registration and JWT auth
- Document upload via presigned URL (PDF, DOCX, TXT)
- Phase 1 ingestion (text extraction, chunking, storage)
- Full-text keyword search (tenant-isolated)
- Rate limiting and quota enforcement
- SvelteKit UI: auth, upload, document list, keyword search

**Goals:**
- Validate core workflow end-to-end in a real environment
- Identify critical bugs before semantic search is added
- Test infrastructure stability (Docker Compose → initial cloud deploy)

**Risks:**
- Text extraction fails on uncommon PDF formats → mitigation: test with diverse document types before release
- Supabase Storage S3 presigned URL expiry too short → set to 10 minutes; surface clear UX message

---

### Beta Release (End of Sprint 10)

**Features Included:**
- All Alpha features +
- Hybrid semantic search (pgvector + RRF)
- RAG Q&A with SSE streaming
- AI API Gateway with multi-provider fallback
- Feature Flag Service + `rag_enabled` gate
- Webhook delivery with HMAC and retry
- Email notifications
- Activity feed with cursor pagination
- Full SvelteKit UI for all tenant features

**Goals:**
- Validate semantic search quality with real user documents
- Validate SSE streaming UX (token speed, reconnection)
- Collect feedback on Q&A quality and relevance
- Verify webhook delivery reliability with test endpoints

**Risks:**
- LLM answer quality disappoints users → mitigate: tune prompt template; allow model selection per tenant
- SSE disconnection on slow connections → implement `EventSource` auto-reconnect with `Last-Event-ID`

---

### Production Release (End of Sprint 12)

#### Launch Checklist
- [ ] All security audit items resolved
- [ ] Load test passed (50 concurrent users, no 5xx)
- [ ] PgBouncer configured and tested under load
- [ ] All services deployed to Deno Deploy
- [ ] Managed PostgreSQL + Upstash Redis + S3 configured
- [ ] CI/CD pipeline (lint → test → deploy) passing
- [ ] `/health` endpoints returning 200 for all services
- [ ] Uptime monitoring configured with alerting
- [ ] Runbook documented and reviewed
- [ ] CORS locked to production origins
- [ ] Secrets in environment variables (no hardcoded values)
- [ ] Rate limits tuned for production traffic
- [ ] Email provider sending from verified domain
- [ ] SSL/TLS certificates provisioned
- [ ] Error reporting (Sentry or equivalent) configured

#### Rollback Plan
1. Every Deno Deploy deployment is versioned; `deno deploy dashboard` shows history.
2. Rollback command: `fly deploy --image <previous-image>` (takes ~60 seconds)
3. Database migrations are forward-only; backward-incompatible migrations require a maintenance window
4. If DB migration causes issues, restore from automated backup (Supabase point-in-time)
5. Redis data is transient (sessions, cache); loss is acceptable on rollback
6. Supabase Storage S3 documents are immutable; no rollback needed for object storage

#### Monitoring Checklist
- [ ] `/health` endpoints monitored every 1 minute
- [ ] Alert on: 5xx rate > 1%, search P95 > 1s, queue depth > 100 jobs, DLQ > 0
- [ ] Log aggregation ingesting structured JSON from all services
- [ ] Admin dashboard metrics charts showing live data
- [ ] Supabase pg_cron dashboard (or Bull Board) accessible for queue inspection

---

## 9. Risk Management

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Deno + Supabase pg_cron incompatibility** (npm:bullmq on Deno 2.x) | Medium | High | Test `npm:bullmq` on Deno 2.1+ in Sprint 1; have Supabase pg_cron as fallback |
| **pgvector index performance** (slow HNSW under large vector count) | Low | High | Benchmark early (Sprint 6); use HNSW with `ef_construction=128`; limit chunks per tenant |
| **LLM provider rate limits** (Gemini embedding API) | Medium | High | Implement per-chunk delay; batch embedding calls; local Ollama fallback |
| **Embedding API cost overrun** (high volume in beta) | Medium | Medium | Set quota limits early; use `gemini-embedding-2` (cheapest Gemini model); Ollama for dev |
| **PDF extraction failures** (corrupt or scanned PDFs) | High | Medium | Use multiple extraction libraries (fallback chain); graceful status = `failed` with clear error |
| **Cross-tenant data leak** (missing tenant_id filter) | Low | Critical | Audit every SQL query in Sprint 12; add integration tests for IDOR; Drizzle query builder reduces raw SQL risk |
| **Redis unavailability** (sessions, rate limiter) | Low | High | Circuit breaker on Redis; fail-open for rate limiter with logged alert; JWT still valid for 15min |
| **Scope creep** (adding features beyond PRD) | High | Medium | Strict sprint goals; defer non-MVP features to post-launch backlog; weekly solo review |
| **Developer burnout** (solo, 12-16 sprint timeline) | Medium | High | Cap sprints at 35h; take a rest day if blocked; timebox research |
| **Webhook delivery failures at scale** | Medium | Medium | Per-URL circuit breaker; DLQ capture; exponential backoff; dashboard visibility |
| **Storage costs** (large Supabase Storage S3 uploads) | Low | Medium | Enforce 25 MB file limit; enforce storage quota per tenant tier |
| **JWT secret compromise** | Low | Critical | Store in environment variable (not code); document rotation procedure; short 15-min JWT TTL limits blast radius |
| **CI/CD pipeline failure blocking deployment** | Medium | Medium | Manual deployment runbook as fallback; keep Dockerfile and Fly.toml clean |
| **SvelteKit SSR auth issues** (JWT in cookies vs localStorage) | Medium | Medium | Use httpOnly cookies for refresh token; SvelteKit server hooks for session hydration |
| **Queue DLQ growth** (silent failures) | Low | High | DLQ metric alert; admin dashboard DLQ viewer; weekly DLQ review |

---

## 10. Project Timeline

### Gantt-Style Roadmap

| Sprint | Week | Focus | Phase | Status |
|--------|------|-------|-------|--------|
| Sprint 1 | Week 1 | Discovery, Monorepo, Schema, Docker Compose | Foundation | ⬜ Planned |
| Sprint 2 | Week 2 | Auth, JWT, Redis Session, Tenant Context | Phase 1 | ⬜ Planned |
| Sprint 3 | Week 3 | Document Upload, Ingestion Worker, Full-Text Search | Phase 1 | ⬜ Planned |
| Sprint 4 | Week 4 | Rate Limiting, Quota, Error Standardization | Phase 1 | ⬜ Planned |
| Sprint 5 | Week 5 | SvelteKit Frontend MVP (Auth + Upload + Search UI) | Phase 1 | ⬜ Planned |
| Sprint 6 | Week 6 | pgvector, Embedding Worker, Hybrid Search + RRF | Phase 2 | ⬜ Planned |
| Sprint 7 | Week 7 | RAG Q&A Service + AI API Gateway | Phase 2 | ⬜ Planned |
| Sprint 8 | Week 8 | Feature Flag Service + Webhook Delivery System | Phase 3 | ⬜ Planned |
| Sprint 9 | Week 9 | Notifications, Activity Feed, Admin API | Phase 3 | ⬜ Planned |
| Sprint 10 | Week 10 | SvelteKit UI Phase 2 (Semantic Search, Chat, Activity) | Phase 3 | ⬜ Planned |
| Sprint 11 | Week 11 | Admin Dashboard + Observability + Structured Logging | Phase 3 | ⬜ Planned |
| Sprint 12 | Week 12 | Hardening, Security Audit, Load Test, Production Deploy | Phase 4 | ⬜ Planned |

> **Buffer Weeks (Post-Sprint 12):** 2 weeks reserved for unexpected production issues, UAT feedback fixes, and documentation polish before public launch announcement.

---

### Milestones

| # | Milestone | Target Week | Deliverable |
|---|-----------|------------|-------------|
| M1 | **Foundation Complete** | End of Week 1 | Monorepo, Docker Compose, schema, ADRs |
| M2 | **Auth System Complete** | End of Week 2 | JWT + Redis session fully tested |
| M3 | **Phase 1 MVP Complete** | End of Week 5 | Upload → full-text search + SvelteKit UI working |
| M4 | **Alpha Release** | End of Week 5 | Deployed to cloud, internal testing begins |
| M5 | **Semantic Search Live** | End of Week 6 | Hybrid search (pgvector + RRF) in production |
| M6 | **RAG Q&A Live** | End of Week 7 | Streaming chat endpoint working |
| M7 | **Phase 3 Features Complete** | End of Week 9 | Webhooks, notifications, activity feed, admin API |
| M8 | **Beta Release** | End of Week 10 | All features UI-complete; beta users onboarded |
| M9 | **Production Hardening Complete** | End of Week 12 | Security audit, load test, PgBouncer |
| M10 | **Production Launch** | End of Week 12 | Live on production URL, monitoring active |

---

## 11. Production Readiness Checklist

### Product
- [ ] All PRD features implemented and tested
- [ ] MVP scope explicitly defined and signed off
- [ ] Out-of-scope items documented in backlog
- [ ] User onboarding flow tested with 3+ real users

### UI/UX
- [ ] All critical flows user-tested (upload, search, chat)
- [ ] WCAG 2.1 AA accessibility verified
- [ ] Responsive design tested on mobile, tablet, desktop
- [ ] Error states and empty states implemented for all screens
- [ ] Loading states and skeleton screens on all async operations
- [ ] 404 and 500 error pages implemented

### Frontend
- [ ] SvelteKit build completes without warnings
- [ ] All API error responses handled gracefully (no unhandled rejections)
- [ ] SSE reconnection logic implemented for chat
- [ ] JWT refresh handled automatically (no forced logouts on token expiry)
- [ ] OAuth redirect flow tested in production domain (redirect URIs whitelisted in Google/GitHub app settings)
- [ ] "Continue with Google/GitHub" buttons present on login and register pages
- [ ] Environment variables in `.env` (not hardcoded in source)
- [ ] Production build tested locally (`vite build && vite preview`)
- [ ] CSP headers configured

### Backend
- [ ] All endpoints have Zod input validation
- [ ] All endpoints return standard error envelope
- [ ] Request ID propagated across all service calls
- [ ] All internal service calls use `X-Request-ID` header
- [ ] No secrets hardcoded in source code
- [ ] All Supabase pg_cron jobs have retry + DLQ configured
- [ ] All circuit breakers configured with correct defaults
- [ ] Worker processes restart automatically on crash (Deno Deploy restart policy)

### Database
- [ ] All Drizzle migrations applied to production DB
- [ ] All `tenant_id` indexes created
- [ ] HNSW index on `embedding` column created
- [ ] GIN index on `ts_content` column created
- [ ] PgBouncer configured (max 100 connections, transaction mode)
- [ ] Automated daily backups confirmed
- [ ] Cross-tenant data isolation integration test passing

### Security
- [ ] JWT secret stored in environment variable (min 256-bit entropy)
- [ ] bcrypt cost factor ≥ 12 on all password hashes
- [ ] OAuth `state` CSRF protection: single-use, 5-minute Redis TTL, deleted on use
- [ ] OAuth client secrets stored only in environment variables (never in source)
- [ ] OAuth redirect URIs restricted to known production origins in Google and GitHub dashboards
- [ ] OAuth-only accounts (no password) cannot log in via email/password endpoint
- [ ] CORS restricted to known production origins
- [ ] HMAC webhook signing working and verified
- [ ] Supabase Storage S3 bucket is private (no public listing)
- [ ] Presigned URL TTL set to 10 minutes
- [ ] All SQL queries use parameterized values (Drizzle ORM — no raw string interpolation)
- [ ] OWASP Top 10 checklist reviewed; no critical issues
- [ ] Admin endpoints protected by `role=admin` JWT claim
- [ ] Rate limiting active on all public endpoints

### Testing
- [ ] Unit test coverage ≥ 80% on business logic modules
- [ ] Integration tests passing in CI (full Docker Compose stack)
- [ ] Playwright E2E tests passing for 5 critical flows
- [ ] k6 load test: search P95 < 700ms, RAG first-token P95 < 3s
- [ ] IDOR cross-tenant test passing
- [ ] DLQ behavior verified (forced failure → retry → DLQ)

### DevOps
- [ ] GitHub Actions CI passing (lint → typecheck → unit test → integration test → deploy)
- [ ] Deno Deploy deployment successful for all worker services
- [ ] Deno Deploy successful for gateway and frontend
- [ ] `fly.toml` configured with `min_machines_running = 1` for workers
- [ ] Environment variables set in Deno Deploy secrets and Deno Deploy env
- [ ] Docker Compose `docker-compose.yml` tested from clean state

### Documentation
- [ ] `README.md` with local setup instructions
- [ ] `.env.example` fully documented with all required variables
- [ ] API documentation (Hono OpenAPI or Bruno collection)
- [ ] Runbook: deployment, rollback, incident response
- [ ] ADRs written for key architecture decisions
- [ ] Database schema ERD diagram

### Monitoring
- [ ] `/health` endpoints returning 200 for all services
- [ ] Uptime monitoring configured (alerts to email/Slack)
- [ ] Log aggregation ingesting structured JSON logs
- [ ] Admin metrics dashboard showing live data
- [ ] Alerts configured: 5xx rate > 1%, search P95 > 1s, DLQ > 0
- [ ] Supabase pg_cron queue depth visible in admin dashboard

---

## 12. Post-Launch Plan

### Week 1-2 Post-Launch: Stabilization

**Bug Fixing:**
- Monitor Sentry/log aggregator for P0/P1 errors hourly
- Hotfix deployment process: `git cherry-pick → CI → fly deploy` (target: < 2h from detection to fix)
- Triage all bugs into: P0 (fix now), P1 (fix today), P2 (next sprint), P3 (backlog)

**User Feedback Collection:**
- In-app feedback widget (Canny or simple form → email)
- Follow-up email to all beta users asking for 5-minute structured feedback
- Watch session recordings (Hotjar or Microsoft Clarity — free tier) for UX friction
- Monitor support email for recurring issues

### Month 1 Post-Launch: Iteration

**Analytics Review:**
- Track: registration rate, upload completion rate, search-to-chat conversion, session length, return visit rate
- Identify drop-off points in onboarding funnel
- Identify most-used document types and search patterns
- Review DLQ stats: what document types fail most?

**Feature Iteration (Priority Backlog):**
1. Document tagging and collections (user-requested)
2. Shared search results (link to specific result)
3. Multi-file Q&A (ask across multiple documents simultaneously)
4. Import from URL (web page ingestion)
5. Custom embedding model selection per tenant
6. Export conversation as PDF
7. API key authentication for developer tenants

### Month 2-3 Post-Launch: Growth Features

**Technical Debt Management:**
- Audit Supabase pg_cron job schema — add schema versioning for backward compatibility
- Refactor circuit breaker into shared library with configurable defaults per service
- Add database query profiling (slow query log on PostgreSQL)
- Review Redis memory usage; add key TTL hygiene
- Upgrade dependencies (Deno, SvelteKit, Hono) to latest stable versions

**Future Enhancements:**
- **Multi-user tenants:** Allow organizations with multiple users under one tenant (requires RBAC)
- **Billing integration:** Stripe for Pro tier subscriptions with usage-based limits
- **Document versioning:** Track changes to documents over time
- **Advanced analytics:** Per-document search hit rate, Q&A quality scoring
- **Grafana full integration:** Replace admin metrics charts with Grafana dashboards
- **URL shortener for document sharing:** Share specific search results or conversations via short link
- **Self-hosted deployment:** Helm chart for Kubernetes deployment
- **SAML/SSO:** Enterprise auth integration

### Ongoing: Monthly Maintenance Cadence

| Task | Frequency |
|------|-----------|
| Dependency security audit (`deno audit`) | Monthly |
| DLQ review and manual retry or discard | Weekly |
| Activity log retention cron verification | Weekly |
| Database backup restore test | Monthly |
| Load test regression | Monthly (or after major changes) |
| JWT secret rotation | Quarterly |
| Review and update API rate limits based on usage patterns | Monthly |
| Admin review of tenant quota usage and tier compliance | Weekly |

---

*This document covers Dokyudo from zero to production for a solo developer. Each sprint is designed to ship a working, testable increment. Prioritize MVP delivery (Sprints 1-5), then iterate with semantic/AI features (Sprints 6-12). Ship, measure, learn.*