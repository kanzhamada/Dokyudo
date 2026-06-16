<p align="center">
  <h1 align="center">Dokyudo</h1>
  <p align="center">Semantic Document Search & RAG Q&A Platform</p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Deno-2.x-000?logo=deno" alt="Deno" />
  <img src="https://img.shields.io/badge/SvelteKit-2.x-FF3E00?logo=svelte" alt="SvelteKit" />
  <img src="https://img.shields.io/badge/Hono-Framework-E36002?logo=hono" alt="Hono" />
  <img src="https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-BullMQ-DC382D?logo=redis" alt="Redis" />
</p>

---

**Dokyudo** is a multi-tenant SaaS platform that lets users upload documents (PDF, DOCX, TXT), then search and ask questions about their content using hybrid semantic search and RAG-powered Q&A with streaming responses.

Built with **SvelteKit** (frontend) and **Deno + Hono** (backend), it demonstrates production-grade distributed system patterns: multi-tenancy, vector search, job queues, webhooks, feature flags, circuit breakers, and observability — all in one integrated product.

> For full requirements, see [PRD.md](./PRD.md). For sprint planning, see [SPRINT.md](./SPRINT.md).

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Folder Structure](#folder-structure)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Tech Stack](#tech-stack)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│  CLIENT — SvelteKit (SSR + CSR)                      │
│  Tenant UI (/app/*) │ Admin UI (/admin/*)            │
└──────────────┬───────────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────────┐
│  API GATEWAY — Deno + Hono                           │
│  Auth (JWT+Redis) │ Rate Limit │ Feature Flag Enf.   │
└──────┬──────────────┬──────────────┬─────────────────┘
       ▼              ▼              ▼
  Ingestion     Search Svc     RAG Service
  Service       (Hybrid RRF)   (SSE Streaming)
       │              │              │
       ▼              ▼              ▼
  ┌─────────┐   ┌──────────┐   ┌──────────────┐
  │ BullMQ  │   │ PG +     │   │ AI API GW    │
  │ Workers │   │ pgvector │   │ (separate)   │
  └─────────┘   └──────────┘   └──────────────┘
```

---

## Folder Structure

```
Dokyudo/
│
├── apps/
│   ├── backend/                      # Deno — API Gateway + all backend services
│   │   ├── deno.jsonc                # Workspace member config, tasks, imports
│   │   ├── .env                      # Encrypted env vars
│   │   └── src/
│   │       ├── main.ts               # Application entry point
│   │       ├── config/
│   │       │   ├── drizzle.ts        # Drizzle client & RLS wrappers
│   │       │   ├── env.ts            # Environment variable validation
│   │       │   ├── hono.ts           # Hono types
│   │       │   └── supabase.ts       # Supabase Admin & Auth clients
│   │       ├── controllers/
│   │       │   └── auth.controller.ts
│   │       ├── middlewares/
│   │       │   ├── error.middleware.ts
│   │       │   └── request.middleware.ts
│   │       ├── models/
│   │       │   └── schema.ts         # Drizzle ORM schemas
│   │       ├── routes/
│   │       │   ├── auth.routes.ts
│   │       │   └── index.ts          # Main router aggregator
│   │       ├── schemas/
│   │       │   ├── auth.schema.ts
│   │       │   └── shared.schema.ts
│   │       ├── services/
│   │       │   └── auth.service.ts   # Core business logic
│   │       ├── tests/
│   │       │   └── auth.api.test.ts
│   │       ├── types/
│   │       │   └── auth.types.ts
│   │       └── utils/
│   │           ├── errors.util.ts
│   │           └── recaptcha.util.ts
│   ├── ai-gateway/                   # Separate Deno service (AI API Gateway)
│   │   ├── deno.jsonc
│   │   ├── .env
│   │   ├── main.ts
│   │   └── src/
│   │       ├── app.ts
│   │       ├── router.ts             # POST /v1/chat/completions
│   │       ├── providers/
│   │       │   ├── openai.ts
│   │       │   ├── anthropic.ts
│   │       │   └── ollama.ts
│   │       ├── routing/
│   │       │   ├── strategy.ts       # Priority-based fallback
│   │       │   └── circuit-breaker.ts
│   │       └── logger.ts
│   │
│   └── frontend/                     # SvelteKit (Node.js)
│       ├── package.json
│       ├── svelte.config.js
│       ├── vite.config.ts
│       ├── .env
│       └── src/
│           ├── app.html
│           ├── hooks.server.ts       
│           ├── lib/
│           │   ├── api/
│           │   │   ├── auth.ts       # Auth endpoints
│           │   │   └── client.ts     # Base API client
│           │   ├── components/
│           │   │   ├── ui/           # shadcn-svelte primitives
│           │   │   ├── layout/       # Shell, Sidebar, TopNav
│           │   │   ├── search/       # SearchBar, ResultCard
│           │   │   ├── chat/         # ChatWindow, SSEStream
│           │   │   ├── documents/    # UploadDropzone, DocList
│           │   │   └── dashboard/    # StatsCard, QuotaBar
│           │   ├── hooks/
│           │   ├── schemas/
│           │   ├── stores/           # Svelte reactive stores
│           │   ├── styles/
│           │   ├── types/
│           │   │   ├── api.types.ts
│           │   │   ├── auth.types.ts
│           │   │   └── recaptcha.types.ts
│           │   └── utils/
│           │       └── recaptcha.util.ts
│           └── routes/
│               ├── +layout.svelte
│               ├── +page.svelte      # Landing page
│               ├── (auth)/           # Login, Register, OAuth
│               ├── (tenant)/         # /app/* — tenant dashboard
│               └── (admin)/          # /admin/* — admin panel
│
├── packages/
│   ├── shared/                       # Cross-app types, constants, schemas
│   │   ├── deno.jsonc
│   │   ├── mod.ts
│   │   ├── types/                    # API, auth, event, tenant types
│   │   ├── constants/                # Error codes, quota tiers, Redis keys
│   │   └── schemas/                  # Shared Zod validation schemas
│   │
│   └── db/                           # Drizzle ORM (schemas + migrations)
│       ├── deno.jsonc
│       ├── drizzle.config.ts
│       ├── client.ts
│       ├── schema/                   # Table definitions
│       │   ├── users.ts
│       │   ├── tenants.ts
│       │   ├── documents.ts
│       │   ├── chunks.ts
│       │   ├── conversations.ts
│       │   ├── webhooks.ts
│       │   ├── feature-flags.ts
│       │   └── activities.ts
│       ├── migrations/               # Generated SQL migrations
│       └── seed/                     # Dev + admin seed data
│
├── infra/                            # Infrastructure & DevOps
│   ├── docker/                       # Dockerfiles per service
│   ├── postgres/                     # init.sql, pgbouncer config
│   ├── redis/                        # Custom redis.conf
│   ├── supabase/                        # DB and Storage config
│   └── scripts/                      # migrate.sh, seed.sh, health-check
│
├── collections/                      # API request collections (Bruno/YAML)
│   ├── Auth/
│   ├── Documents/
│   ├── Search & RAG/
│   ├── Webhooks & Quotas/
│   ├── Admin & Internal/
│   └── System/
│
├── ai/docs/                          # Second Brain documentation
├── tests-report/                     # Security & performance reports
├── .agents/                          # Agent rules & skills
│
├── deno.jsonc                        # Root Deno workspace config
├── docker-compose.yml                # Local dev orchestration
├── PRD.md                            # Product Requirements Document
├── SPRINT.md                         # Sprint execution plan
└── README.md                         # ← You are here
```

> **Design note:** All backend services are colocated under `apps/backend/` as modules — not separate deployable apps. The API Gateway imports and mounts each service's router in a single Deno process. Workers use a different entry point (`workers/entry.ts`) but share the same codebase. The **AI API Gateway** is the only service separated into its own `apps/` directory because the PRD mandates it as an independent HTTP service.

---

## Prerequisites

| Tool | Version | Installation |
|------|---------|--------------|
| **Deno** | 2.x+ | [deno.land](https://deno.land/#installation) |
| **Node.js** | 20+ | [nodejs.org](https://nodejs.org/) (for SvelteKit frontend) |
| **Docker** | 24+ | [docker.com](https://docs.docker.com/get-docker/) |
| **Docker Compose** | v2+ | Bundled with Docker Desktop |
| **Git** | 2.40+ | [git-scm.com](https://git-scm.com/) |

### Optional

| Tool | Purpose |
|------|---------|
| **Bruno** | API request testing (reads `collections/`) |
| **Ollama** | Local LLM fallback (avoids OpenAI costs during dev) |

---

## Environment Configuration

### 1. Backend (`apps/backend/.env`)

Create a `.env` file from the example template:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Required variables:

```env
# ── Database ──
DATABASE_URL=postgres://dokyudo:dokyudo@localhost:5432/dokyudo

# ── Redis ──
REDIS_URL=redis://localhost:6379

# ── Object Storage (Supabase Storage S3) ──
SUPABASE_STORAGE_ENDPOINT=localhost
SUPABASE_STORAGE_PORT=9000
SUPABASE_STORAGE_ACCESS_KEY=supabase-storageadmin
SUPABASE_STORAGE_SECRET_KEY=supabase-storageadmin
SUPABASE_STORAGE_BUCKET=dokyudo-uploads
SUPABASE_STORAGE_USE_SSL=false

# ── JWT ──
JWT_SECRET=your-256-bit-secret-here
JWT_EXPIRY=900                          # 15 minutes in seconds

# ── Embedding API ──
OPENAI_API_KEY=sk-...                   # Required for semantic search
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSION=1536

# ── OAuth (Google) ──
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
OAUTH_REDIRECT_BASE_URL=http://localhost:8000

# ── OAuth (GitHub) ──
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# ── Email Notifications (optional) ──
SENDGRID_API_KEY=SG.xxx
NOTIFICATION_FROM_EMAIL=noreply@dokyudo.app
```

### 2. AI API Gateway (`apps/ai-gateway/.env`)

```env
# ── LLM Providers ──
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_BASE_URL=http://localhost:11434  # Optional: local fallback

# ── Server ──
AI_GATEWAY_PORT=8001
```

### 3. Frontend (`apps/frontend/.env`)

```env
# ── API Gateway URL ──
INTERNAL_API_GATEWAY_URL=http://localhost:8000
PUBLIC_API_URL=http://localhost:8000/api
```

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-org/Dokyudo.git
cd Dokyudo
```

### 2. Start infrastructure services

```bash
docker-compose up -d
```

This boots:
- **PostgreSQL + pgvector** — `localhost:5432`
- **Redis** — `localhost:6379`
- **Supabase Storage S3** — `localhost:9000` (console: `localhost:9001`)
- **Ollama** *(optional)* — `localhost:11434`

Verify everything is running:

```bash
docker-compose ps
```

### 3. Run database migrations

```bash
# From the project root
cd packages/db
deno task migrate
```

### 4. Seed development data (optional)

```bash
cd packages/db
deno task seed
```

### 5. Start the backend

```bash
cd apps/backend
deno task dev
```

The API Gateway starts on **`http://localhost:8000`** by default.

### 6. Start the workers (separate terminal)

```bash
cd apps/backend
deno task dev:workers
```

### 7. Start the AI API Gateway (separate terminal)

```bash
cd apps/ai-gateway
deno task dev
```

Runs on **`http://localhost:8001`**.

### 8. Start the frontend

```bash
cd apps/frontend
npm install        # First time only
npm run dev
```

SvelteKit dev server starts on **`http://localhost:5173`**.

### Quick Start (all at once)

From the project root, you can run all services simultaneously:

```bash
# Terminal 1 — Infrastructure
docker-compose up -d

# Terminal 2 — Backend + Workers
deno task dev

# Terminal 3 — AI Gateway
deno task dev:ai

# Terminal 4 — Frontend
cd apps/frontend && npm run dev
```

---

## Development Workflow

### Running Tests

```bash
# Backend unit + integration tests
cd apps/backend
deno test --allow-all

# AI Gateway tests
cd apps/ai-gateway
deno test --allow-all

# Frontend checks
cd apps/frontend
npm run check
npm run lint
```

### Database Operations

```bash
# Generate a new migration after schema changes
cd packages/db
deno task generate

# Apply pending migrations
deno task migrate

# Open Drizzle Studio (visual DB browser)
deno task studio
```

### API Testing with Bruno

Open the `collections/` directory in [Bruno](https://www.usebruno.com/) to access pre-built request collections organized by domain:

| Collection | Endpoints |
|------------|-----------|
| `Auth/` | Register, Login, Refresh, Logout, OAuth flows |
| `Documents/` | Presigned URL, Upload metadata, List, Status |
| `Search & RAG/` | Hybrid search, Chat (SSE) |
| `Webhooks & Quotas/` | Register webhook, Quota usage |
| `Admin & Internal/` | Tenant management, Feature flags, Metrics |
| `System/` | Health checks |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | SvelteKit, TailwindCSS 4, shadcn-svelte |
| **Backend** | Deno 2.x, Hono, TypeScript |
| **Database** | PostgreSQL + pgvector, Drizzle ORM |
| **Cache & Queue** | Redis, ioredis, BullMQ |
| **Object Storage** | Supabase Storage S3 (local/Docker) / Supabase Storage S3 (prod) |
| **LLM Providers** | OpenAI, Anthropic, Ollama |
| **Auth** | JWT (15min) + Redis sessions (24h), OAuth (Google/GitHub) |
| **Observability** | Structured JSON logs, Grafana Loki (optional) |

---

## License

This project is proprietary. All rights reserved.
