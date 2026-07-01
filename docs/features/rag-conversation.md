# RAG Conversation Management

## Core Logic
This feature encompasses the conversational memory capabilities and management of the Retrieval-Augmented Generation (RAG) system. It enables the AI to "remember" past interactions during a chat session without suffering from context bloat. Additionally, it provides users with full control over their data by allowing them to rename conversation titles and permanently delete chat histories. 

Key capabilities:
- **Conversation Memory (Sliding Window):** Automatically fetches up to 3 of the most recent conversation turns when a `conversationId` is provided.
- **Standalone Query Rewriting:** Uses a high-speed LLM (Gemini Flash Lite) to rewrite follow-up questions contextually, ensuring hybrid searches remain highly accurate and do not match against vague pronouns.
- **Prompt Guardrails:** Protects against document-based prompt injection by isolating the context documents inside the augmented prompt.
- **Tier Quota Validation (Soft Lock):** Enforces monthly Q&A limits based on the tenant's subscription tier. Blocks requests with HTTP 400 if limits are exceeded.
- **Conversation CRUD:** Endpoints to safely update conversation titles and delete histories, scoped by `tenantId` to ensure multi-tenant data isolation.

## Flow Diagram

```mermaid
sequenceDiagram
    actor Client
    participant API Gateway
    participant RagService
    participant LLM (Query Rewriter)
    participant Hybrid Search
    participant LLM (Main Generator)
    participant Database

    %% Memory & Query Rewriting Flow
    Client->>API Gateway: POST /api/rag/chat (question, conversationId)
    API Gateway->>RagService: Extract Auth & Route
    RagService->>Database: Fetch tenant_subscriptions
    alt Quota Exceeded
        RagService-->>Client: 400 Validation Error (Quota Exceeded)
    end
    RagService->>Database: Fetch max 3 recent turns
    Database-->>RagService: Return conversation_turns
    RagService->>LLM (Query Rewriter): Rewrite question with History
    LLM (Query Rewriter)-->>RagService: Standalone Query
    RagService->>Hybrid Search: Search using Standalone Query
    Hybrid Search-->>RagService: Top 5 Context Documents
    RagService->>Database: UPDATE tenant_subscriptions (qaCount + 1)
    RagService->>LLM (Main Generator): Augmented Prompt (History + Guardrails + Docs)
    LLM (Main Generator)-->>Client: SSE Token Stream
    RagService->>Database: Async Save new conversation_turn

    %% Management Flow
    Client->>API Gateway: PATCH /api/rag/conversations/:id
    API Gateway->>RagService: Validate Zod Schema
    RagService->>Database: UPDATE title WHERE tenantId = tenantId
    Database-->>Client: 200 OK

    Client->>API Gateway: DELETE /api/rag/conversations/:id
    API Gateway->>RagService: Validate Auth
    RagService->>Database: DELETE WHERE tenantId = tenantId
    Database-->>Client: 200 OK
```

## Completion Timestamp
**Date:** 2026-07-01
**Time:** 16:55 (UTC+7)

## File Mapping
- `apps/backend/src/modules/rag/rag.service.ts`: Implemented tier quota checking, `streamChat` query rewriting, `updateConversationTitle`, and `deleteConversation`.
- `apps/backend/src/modules/rag/rag.controller.ts`: Added request validation and execution handlers for the new routes.
- `apps/backend/src/modules/rag/rag.routes.ts`: Registered OpenAPI schemas for `PATCH` and `DELETE`.
- `apps/backend/src/modules/rag/rag.schema.ts`: Added Zod validations (`UpdateConversationBodySchema`, `ConversationParamSchema`, and max length limits to chat input).
- `apps/backend/src/config/gemini.ts`: Added synchronous `generateText` method for query rewriting and gatekeeping.
- `apps/backend/src/shared/constants/tiers.constant.ts`: Source of truth for all Tier limits and `maxQnaPerMonth` constraints.

## Connections
- **Client (Frontend):** Sends `conversation_id` in subsequent chat requests to maintain memory. Can send HTTP requests to rename or remove chats.
- **Deno API (Backend):** Manages the logic, performs the contextual rewriting, and streams responses.
- **PostgreSQL (Database):** Holds `conversations` and `conversation_turns`, isolated via `tenant_id`.
- **LLM Provider (Gemini):** Dual usage. `gemini-3.1-flash-lite` used as a high-speed pre-processor for both security gatekeeping and query contextualization, before handling the main generation.

## Architectural Decisions
1. **Sliding Window Memory (Max 3):** Chosen over full history injection to prevent token exhaustion and to ensure the LLM's attention span remains highly focused on the actual retrieved knowledge documents.
2. **LLM Query Rewriting:** Implemented to prevent vague queries (e.g., "what is its price?") from destroying the vector search accuracy. Context is resolved *before* embedding.
3. **LLM-as-a-Judge Guardrails:** Utilizes Gemini as a fast pre-flight checker to block Prompt Injection attempts (e.g. "Ignore instructions and write code") from ever hitting the RAG pipeline.
4. **Tenant-Level Deletions:** Drizzle ORM queries for `update` and `delete` strictly mandate an `eq(conversations.tenantId, tenantId)` constraint to prevent IDOR (Insecure Direct Object Reference) vulnerabilities.
5. **Tier Validation (Soft Lock):** Checking the `tenant_subscriptions` table before generating responses guarantees that tenants on a FREE tier cannot drain Google Gemini API quotas once their budget is exhausted. This acts as a robust mechanism against DoS abuse via repeated prompts.
6. **Atomic Quota Increments:** Used `sql` string literals to safely run `SET qaCount = qaCount + 1` right before streaming the LLM response, minimizing race conditions for concurrency limits.
