# Auth Security & Correlation Logic

## Core Logic
The authentication service incorporates multi-dimensional rate limiting and anti-brute-force correlation. The system relies on Google reCAPTCHA v3 for client-side fingerprinting and bot detection, and backend-enforced limits on IP and Email combinations to stop credential stuffing and password spraying. 

### Key Protections
1. **Google reCAPTCHA v3 Validation**: Verifies a token with Google, requiring a score of >= 0.5. Re-used tokens naturally trigger a rejection via Google's `siteverify` endpoint.
2. **Per-IP Rate Limiting**: An IP is blocked for 15 minutes after 20 failed login attempts.
3. **User-Agent Anomaly Detection**: If a single IP rotates through > 3 distinct User-Agents within the recent failure window, it is flagged as a botnet/script. Its IP limit instantly drops from 20 to 3.
4. **Per-Email Lockout (Password Spraying)**: If an email is targeted 5 times on the `/login` endpoint (regardless of the originating IPs), the user account is safely locked (`is_locked: true`) for 15 minutes. 
5. **Registration Restrictions**: To prevent fake account creation and email enumeration, the `/register` endpoint logs all attempts. An IP is blocked if it exceeds 20 total attempts (or 3 if a UA anomaly is detected). Additionally, an IP is strictly capped at **5 successful registrations** per 15-minute window.
6. **Database Bloat Prevention**: Requests to an already locked account or from an already blocked IP return `403 FORBIDDEN` or `429 RATE_LIMIT_EXCEEDED` and immediately exit *without* inserting redundant records into the `login_attempts` table.

## Flow Diagram

```mermaid
flowchart TD
    A[Client Request: POST /api/auth/login] --> B{reCAPTCHA Valid?}
    B -- No --> C[Throw 400 Validation Error]
    B -- Yes --> D{Is Account Locked?}
    
    D -- Yes --> E[Throw 403 Forbidden]
    D -- No --> F[Query Recent IP Failures]
    
    F --> G{IP Failures >= 20?}
    G -- Yes --> H[Throw 429 IP Blocked]
    
    G -- No --> I{> 3 Unique User Agents?}
    I -- Yes --> J{IP Failures >= 3?}
    J -- Yes --> H
    
    I -- No --> K[Attempt Supabase Auth]
    J -- No --> K
    
    K -- Success --> L[Return JWTs]
    K -- Fail --> M[Insert into login_attempts]
    
    M --> N{Email Failures >= 5?}
    N -- Yes --> O[Lock Account in DB]
    O --> P[Throw 429 Account Locked]
    
    N -- No --> Q[Throw 401 Unauthorized]
```

## Completion Timestamp
**Date**: 2026-06-19 22:00 (Local Time)

## File Mapping
- **`apps/backend/src/modules/auth/auth.service.ts`**: Contains the core correlation queries, anomaly detection, and DB locking logic.
- **`apps/backend/src/modules/auth/auth.controller.ts`**: Handles routing and graceful error handling.
- **`apps/backend/src/shared/utils/recaptcha.util.ts`**: Enforces the 0.5 score threshold and validates Google `siteverify` payload.
- **`apps/backend/src/tests/api/auth.api.test.ts`**: Houses the unit and integration tests verifying User-Agent anomalies and distributed password spraying.

## Connections
- **Frontend Layer**: Must provide the `recaptchaToken` securely retrieved via Google's `grecaptcha.execute()`.
- **Database Layer**: Uses `public.login_attempts` to aggregate failures. Uses an index `idx_login_attempts_email_ip` to quickly query by `emailAttempted` and `ipAddress` without full table scans.
- **Supabase Layer**: Uses `supabase.auth.admin.signOut` for token revocation and `signInWithPassword` for underlying authentication.

## Architectural Decisions
- **Relying on reCAPTCHA vs. Custom Fingerprinting**: We opted to strictly rely on Google reCAPTCHA v3's client-side checks for hardware/browser fingerprinting (fonts, screen size, Playwright defaults). Building a custom fingerprinting script creates massive GDPR liabilities and performs worse than Google's existing ML models.
- **No User-Agent Blocking**: We do not block requests globally based purely on the `User-Agent` string, as standard UAs are shared by millions of legitimate users. We only use `User-Agent` as an anomaly modifier for a *specific IP*.
- **Graceful Failure**: Non-critical background logs use `try/catch` wrappers to prevent breaking the happy path for users. Rejection paths bypass `logLoginAttempt` inserts to prevent DB bloating during a DDoS.
