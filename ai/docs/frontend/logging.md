---
title: Frontend Simple Logging
description: Architecture and rationale for frontend lifecycle logging using standard console tools.
completed_at: 2026-06-18T23:20:00+07:00
---

# Frontend Simple Logging

## Core Logic
The frontend application completely eschews backend-style "Wide Events" or heavily abstracted logger utilities in favor of **Simple Trace Logging**. 

Because the primary debugging pain point on the frontend is the discrepancy between what the user typed vs. what was actually serialized and sent to the backend, we use explicit `console.log()` statements wrapped around critical form submittal lifecycles.

## Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend as SvelteKit UI
    participant Backend as API Gateway
    
    User->>Frontend: Clicks "Submit" (e.g. Login)
    Note over Frontend: console.log('[Auth Login] Form Submitted', payload)
    Frontend->>Backend: HTTP POST /api/auth/login
    Backend-->>Frontend: 200 OK or Error Response
    Note over Frontend: console.log('[Auth Login] Backend Response', response)
    Frontend->>User: Route Navigation or Display Error
```

## Completion Timestamp
**Date**: June 18, 2026, 23:20:00 UTC+7

## File Mapping
**Implemented In:**
- `apps/frontend/src/routes/(auth)/login/+page.svelte`
- `apps/frontend/src/routes/(auth)/register/+page.svelte`

**Rules Enforced:**
- `.agents/rules/frontend-logging-policy.md` - New mandatory agent instruction to prevent AI from over-engineering frontend loggers in the future.

## Connections
- **Browser DevTools**: These logs are emitted directly to the standard browser console for the developer to inspect.

## Architectural Decisions
- **Rejection of Wide Events**: The backend uses the "Wide Event" pattern because logs are shipped remotely to Grafana Loki, requiring structured JSON tracking. The frontend runs in the user's browser, meaning logs are inspected visually by the developer in real-time. Abstracting this into "Wide Events" overcomplicates the Developer Experience (DX).
- **Explicit Payload Tracing**: Often, "data is missing in the backend body" due to misconfiguration in Svelte form handlers. By enforcing a `console.log` immediately *before* the `fetch()` call, developers can categorically prove whether the Svelte state holds the correct variables.
- **Unmasked Passwords in Dev**: Passwords and sensitive form fields are explicitly logged in `console.log()` during form submission. This is safe because this is purely client-side browser execution, and it vastly accelerates local debugging.
