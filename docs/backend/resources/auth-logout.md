# Auth Logout Feature

## Core Logic
The `POST /api/auth/logout` endpoint allows users to invalidate their active sessions. It reads the Bearer token from the `Authorization` header and uses the Supabase Admin API to globally sign out the user, ensuring their session cannot be refreshed or used again.

**Idempotent Logout**: If a user attempts to log out with an already expired or invalid token, the backend intercepts the resulting Supabase error and treats the request as a success. This ensures a clean, error-free experience for the frontend when clearing local state.

## Flow Diagram
```mermaid
sequenceDiagram
    actor U as User
    participant GW as API Gateway
    participant Supabase as Supabase Auth

    U->>GW: POST /api/auth/logout (Authorization: Bearer <token>)
    GW->>GW: Extract token from header
    GW->>Supabase: admin.signOut(token, 'global')
    
    alt token is valid
        Supabase-->>GW: OK (Session invalidated)
    else token is expired/invalid
        Supabase-->>GW: Error (jwt expired / invalid)
        GW->>GW: Intercept error, treat as success
    end
    
    GW-->>U: 200 OK {"message": "Successfully logged out"}
```

## Completion Timestamp
Completed At: 2026-06-19 19:45:00 UTC+7

## File Mapping
- `apps/backend/src/modules/auth/auth.service.ts`: Added `logoutUser` method.
- `apps/backend/src/modules/auth/auth.controller.ts`: Added `handleLogout` method.
- `apps/backend/src/modules/auth/auth.routes.ts`: Registered `/api/auth/logout` route.
- `apps/backend/src/modules/auth/auth.schema.ts`: Added `LogoutResponseSchema`.
- `apps/backend/src/shared/types/auth.types.ts`: Added `LogoutParams`.

## Connections
- **Database/Server**: Connects to the Supabase Auth instance using the Supabase Admin API (`supabase.auth.admin.signOut()`).
- **Frontend**: Frontend must call this endpoint with the access token in the `Authorization` header.

## Architectural Decisions
- **Native Session Revocation**: Redis is completely removed from the session storage equation. Supabase manages the token revocation natively in its database schema, avoiding split-brain between an external Redis cache and the actual auth state.
- **Idempotent Logout**: Instead of returning a `500 INTERNAL_ERROR` when Supabase rejects an expired token during logout, the backend gracefully catches token-related errors and returns `200 OK`. The end goal (a logged-out state) is already achieved, so there is no need to surface an error to the user or frontend.
