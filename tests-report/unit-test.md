# Backend White Box Testing Report

**Date of Testing:** July 23, 2026
**Target Architecture:** Deno (Hono) Modular Monolith
**Overall Status:** **PASSED** (8 Test Modules, 71 Test Steps)
**Methodology:** BDD (Behavior-Driven Development) via `jsr:@std/testing/bdd`

## 1. Main App & Global Endpoints (`main.test.ts`)

| Test Case / Step | Description & Path | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **GET /health** | `returns 200 with status ok` | HTTP 200, `{"status":"ok"}` | HTTP 200, Match | ✅ Pass |
| **OpenAPI Spec** | `GET /doc returns valid OpenAPI spec` | HTTP 200, OpenAPI v3.1.0 Object | HTTP 200, Match | ✅ Pass |
| **OpenAPI Spec** | `GET /reference returns Scalar API HTML` | HTTP 200, Content-Type `text/html` | HTTP 200, Match | ✅ Pass |


## 2. Auth Module (`auth.routes.test.ts`)

| Test Case / Step | Description & Path | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Register** | `positive: successfully creates a user` | HTTP 201, "Registration successful..." | HTTP 201, Match | ✅ Pass |
| **Register** | `negative: User-Agent anomaly drops IP limit` | HTTP 429, `RATE_LIMIT_EXCEEDED` on 5th req | HTTP 429, Match | ✅ Pass |
| **Register** | `negative: missing email returns 400` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Register** | `negative: invalid email format returns 400` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Register** | `negative: short password returns 400` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Register** | `negative: password too long returns 400` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Register** | `negative: password missing uppercase returns 400`| HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Register** | `negative: password missing lowercase returns 400`| HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Register** | `negative: password missing number returns 400` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Register** | `negative: password missing symbol returns 400` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Register** | `negative: missing recaptchaToken returns 400` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Register** | `negative: empty body returns 400` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Login** | `positive: successfully logs in user` | HTTP 200, returns `accessToken` | HTTP 200, Match | ✅ Pass |
| **Login** | `negative: wrong password returns 401` | HTTP 401, `UNAUTHORIZED` | HTTP 401, Match | ✅ Pass |
| **Login** | `negative: missing email returns 400` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Login** | `negative: missing password returns 400` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Login** | `negative: invalid email format returns 400` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Login** | `negative: User-Agent anomaly drops IP limit` | HTTP 429, `RATE_LIMIT_EXCEEDED` on 5th req | HTTP 429, Match | ✅ Pass |
| **Login** | `negative: Per-Email Spraying Lockout at 5 attempts` | HTTP 429, `RATE_LIMIT_EXCEEDED` on 6th req | HTTP 429, Match | ✅ Pass |
| **Logout** | `positive: successfully logs out user` | HTTP 200, "Successfully logged out" | HTTP 200, Match | ✅ Pass |
| **Logout** | `negative: missing authorization header returns 401`| HTTP 401, `UNAUTHORIZED` | HTTP 401, Match | ✅ Pass |
| **Logout** | `negative: invalid auth header format returns 401`| HTTP 401, `UNAUTHORIZED` | HTTP 401, Match | ✅ Pass |
| **Recovery** | `positive: sends recovery email` | HTTP 200, "...recovery email has been sent" | HTTP 200, Match | ✅ Pass |
| **Recovery** | `negative: missing email returns 400` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Recovery** | `negative: invalid OTP returns 401 (without email)` | HTTP 401, `UNAUTHORIZED` or HTTP 400 | Match | ✅ Pass |
| **Recovery** | `negative: update-password missing auth returns 401`| HTTP 401, `UNAUTHORIZED` | HTTP 401, Match | ✅ Pass |
| **Recovery** | `negative: rate limit exceeded at 5 attempts` | HTTP 429, `RATE_LIMIT_EXCEEDED` | HTTP 429, Match | ✅ Pass |
| **Recovery** | `negative: reset-password missing otp returns 400 (without email)`| HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Recovery** | `negative: reset-password short password returns 400 (without email)`| HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Recovery** | `negative: update-password short password returns 400`| HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **OAuth** | `GET /oauth/google: positive redirect to Supabase` | HTTP 302, `provider=google` in Location | HTTP 302, Match | ✅ Pass |
| **OAuth** | `GET /oauth/github: positive redirect to Supabase` | HTTP 302, `provider=github` in Location | HTTP 302, Match | ✅ Pass |
| **OAuth** | `GET /oauth/google/callback: missing code error` | HTTP 302, redirect `error=Missing...` | HTTP 302, Match | ✅ Pass |
| **OAuth** | `GET /oauth/google/callback: user denied consent` | HTTP 302, redirect `error=User...` | HTTP 302, Match | ✅ Pass |
| **OAuth** | `GET /oauth/google/callback: invalid dummy code` | HTTP 302, redirect `error=OAuth...` | HTTP 302, Match | ✅ Pass |
| **OAuth** | `GET /oauth/github/callback: missing code error` | HTTP 302, redirect `error=Missing...` | HTTP 302, Match | ✅ Pass |
| **OAuth** | `GET /oauth/github/callback: user denied consent` | HTTP 302, redirect `error=User...` | HTTP 302, Match | ✅ Pass |
| **OAuth** | `GET /oauth/github/callback: invalid dummy code` | HTTP 302, redirect `error=OAuth...` | HTTP 302, Match | ✅ Pass |
| **Error Env.** | `Error responses include X-Request-ID trace ID` | `error.requestId` matches Request ID | Matched ID | ✅ Pass |
| **Error Env.** | `Error responses always have the standard envelope`| JSON has `error.code`, `error.message` | Matched Schema| ✅ Pass |
| **Get Profile**| `positive: returns profile for authenticated user`| HTTP 200, Returns JSON | HTTP 200, Match | ✅ Pass |
| **Get Profile**| `negative: missing authorization header returns 401`| HTTP 401, `UNAUTHORIZED` | HTTP 401, Match | ✅ Pass |
| **Verify Email**| `negative: missing tokenHash returns 400` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Verify Email**| `negative: invalid tokenHash returns 401` | HTTP 401, `UNAUTHORIZED` | HTTP 401, Match | ✅ Pass |


## 3. Documents Routes (`documents.routes.test.ts`)

| Test Case / Step | Description & Path | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Presigned URL**| `negative: missing authorization header returns 401`| HTTP 401, `UNAUTHORIZED` | HTTP 401, Match | ✅ Pass |
| **Presigned URL**| `negative: missing required fields returns 400` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Presigned URL**| `negative: file exceeds 25MB returns 400` | HTTP 400, size exceeded message | HTTP 400, Match | ✅ Pass |
| **Presigned URL**| `positive: generates presigned URL for valid payload`| HTTP 201, Returns `url`, `documentId`, `key`| HTTP 201, Match | ✅ Pass |
| **Confirm Upload**|`negative: missing authorization header returns 401`| HTTP 401, `UNAUTHORIZED` | HTTP 401, Match | ✅ Pass |
| **Confirm Upload**|`negative: missing required fields returns 400` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Confirm Upload**|`negative: non-existent document returns 404` | HTTP 404, `NOT_FOUND` | HTTP 404, Match | ✅ Pass |
| **Delete Doc** | `negative: missing authorization returns 401` | HTTP 401, `UNAUTHORIZED` | HTTP 401, Match | ✅ Pass |
| **Delete Doc** | `negative: deleting non-existent document returns 404`| HTTP 404, `NOT_FOUND` | HTTP 404, Match | ✅ Pass |
| **List Docs** | `negative: missing authorization returns 401` | HTTP 401, `UNAUTHORIZED` | HTTP 401, Match | ✅ Pass |
| **List Docs** | `positive: returns list of documents` | HTTP 200, array of docs | HTTP 200, Match | ✅ Pass |
| **Preview** | `negative: missing authorization returns 401` | HTTP 401, `UNAUTHORIZED` | HTTP 401, Match | ✅ Pass |
| **Preview** | `negative: missing document returns 404` | HTTP 404, `NOT_FOUND` | HTTP 404, Match | ✅ Pass |


## 4. Search Routes (`search.routes.test.ts`)

| Test Case / Step | Description & Path | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Search** | `negative: missing authorization header returns 401` | HTTP 401, `UNAUTHORIZED` | HTTP 401, Match | ✅ Pass |
| **Search** | `negative: missing query parameter returns 400` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Search** | `positive: valid query returns 200 and search results` | HTTP 200, Array of data | HTTP 200, Match | ✅ Pass |

## 5. RAG Routes (`rag.routes.test.ts`)

| Test Case / Step | Description & Path | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Chat** | `negative: missing authorization returns 401` | HTTP 401, `UNAUTHORIZED` | HTTP 401, Match | ✅ Pass |
| **Chat** | `negative: invalid body returns 400` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Update Title** | `positive: updates title successfully` | HTTP 200, `success: true` | HTTP 200, Match | ✅ Pass |
| **Update Title** | `negative: empty title returns 400 validation error` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Delete** | `positive: deletes conversation successfully` | HTTP 200, `success: true` | HTTP 200, Match | ✅ Pass |
| **Delete** | `negative: deleting already deleted conversation returns 404` | HTTP 404, `NOT_FOUND` | HTTP 404, Match | ✅ Pass |


## 5. Middlewares & Utils

| Suite | Description & Path | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Auth** | `AuthMiddleware: Missing Authorization header` | HTTP 401, `UNAUTHORIZED` | HTTP 401, Match | ✅ Pass |
| **Auth** | `AuthMiddleware: Invalid JWT signature` | HTTP 401, "Invalid JWT signature" | HTTP 401, Match | ✅ Pass |
| **Auth** | `AuthMiddleware: Valid token with tenant_id` | HTTP 200, Extracts `tenant_id` claims | HTTP 200, Match | ✅ Pass |
| **RateLimit** | `Allows normal requests` | HTTP 200, Contains `x-ratelimit-remaining`| HTTP 200, Match | ✅ Pass |
| **RateLimit** | `Suspicious User-Agents get strict limit` | HTTP 200, `x-ratelimit-remaining` < 10 | HTTP 200, Match | ✅ Pass |
| **RateLimit** | `Penalizes IP on 401 errors` | Redis penalty hits 5, 429 triggered | 429 Blocked | ✅ Pass |
| **IP Util** | `extractClientIp: X-Forwarded-For takes priority` | Returns left-most IP | Parsed IP | ✅ Pass |
| **IP Util** | `extractClientIp: falls back to X-Real-IP` | Returns X-Real-IP | Parsed IP | ✅ Pass |
| **IP Util** | `extractClientIp: falls back to CF-Connecting-IP`| Returns Cloudflare IP | Parsed IP | ✅ Pass |
| **IP Util** | `extractClientIp: falls back to 0.0.0.0 (no headers)`| Returns 0.0.0.0 | 0.0.0.0 | ✅ Pass |
| **IP Util** | `extractClientIp: single IP in X-Forwarded-For`| Returns single IP | Parsed IP | ✅ Pass |
| **S3 Util** | `checkObjectExists: returns false for non-existent`| Returns false | boolean(false) | ✅ Pass |
| **Email Util**| `sendVerificationEmail: parameters mapped right`| Correct payload to Resend client | Passed | ✅ Pass |
| **Email Util**| `sendVerificationEmail: throws on Resend fail`| Throws AppError 500 | AppError thrown| ✅ Pass |
| **Email Util**| `sendRecoveryEmail: parameters mapped right`| Correct payload to Resend client | Passed | ✅ Pass |
| **Email Util**| `sendRecoveryEmail: throws on Resend fail`| Throws AppError 500 | AppError thrown| ✅ Pass |
| **Captcha Util**|`verifyRecaptcha: passes on good score` | Success: true, score >= 0.5 | Success | ✅ Pass |
| **Captcha Util**|`verifyRecaptcha: fails when API rejects` | Throws AppError with API error | AppError thrown| ✅ Pass |
| **Captcha Util**|`verifyRecaptcha: fails on action mismatch` | Throws AppError "action mismatch" | AppError thrown| ✅ Pass |
| **Captcha Util**|`verifyRecaptcha: fails when score too low` | Throws AppError "score too low" | AppError thrown| ✅ Pass |
| **Crypto Util**| `determineAgentType: maps correctly` | BROWSER / NON_BROWSER depending on UA | Mapped | ✅ Pass |
| **Crypto Util**| `validatePuzzleToken: checks length/chars` | Rejects missing, invalid lengths/chars| Rejected | ✅ Pass |
| **Crypto Util**| `validatePuzzleToken: enforces base/opt rules`| Token matches correct Agent type | Matched | ✅ Pass |
| **Error Util**| `AppError: properties assigned correctly` | code, message, status, retryAfter | Matched | ✅ Pass |
| **Error Util**| `AppError: formats to JSON envelope correctly`| Extracts standard Hono-friendly obj | Matched | ✅ Pass |
| **Logger** | `Logs successful request with duration/status` | JSON log has `durationMs`, `status`, `ip`| Matched | ✅ Pass |
| **Logger** | `Logs AppError without stack trace` | JSON log has `error` message, no `stack`| Matched | ✅ Pass |
| **Logger** | `Logs unexpected Error with stack trace` | JSON log has `error` message and `stack`| Matched | ✅ Pass |
| **Req ID** | `Injects new UUID if header missing` | UUID injected into context and header | Matched | ✅ Pass |
| **Req ID** | `Honors incoming X-Request-ID header` | Custom ID injected into context/header | Matched | ✅ Pass |
| **Puzzle** | `Rejects request missing puzzle header` | HTTP 403, "Missing X-Dokyudo-Puzzle..." | HTTP 403 | ✅ Pass |
| **Puzzle** | `Rejects request with invalid signature` | HTTP 403, "Invalid Crypto Puzzle..." | HTTP 403 | ✅ Pass |
| **Puzzle** | `Allows request with valid new puzzle token`| HTTP 200 | HTTP 200 | ✅ Pass |
| **Puzzle** | `Blocks replay attack on reused token` | HTTP 403, "Replay Attack Detected" | HTTP 403 | ✅ Pass |

## 6. Payments Module (`payments.routes.test.ts`)

| Test Case / Step | Description & Path | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Checkout** | `positive: returns 201 with checkout url` | HTTP 201, `checkoutUrl`, `sessionId` | HTTP 201, Match | ✅ Pass |
| **Checkout** | `negative: invalid tier returns 400` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Checkout** | `negative: missing authorization returns 401` | HTTP 401, `UNAUTHORIZED` | HTTP 401, Match | ✅ Pass |
| **Portal** | `negative: rejects if tenant has no active stripe customer` | HTTP 400, `VALIDATION_ERROR` | HTTP 400, Match | ✅ Pass |
| **Portal** | `negative: missing authorization returns 401` | HTTP 401, `UNAUTHORIZED` | HTTP 401, Match | ✅ Pass |
| **Webhook** | `negative: missing stripe-signature returns 401` | HTTP 401, `UNAUTHORIZED` | HTTP 401, Match | ✅ Pass |
| **Webhook** | `negative: invalid signature returns 401` | HTTP 401, `UNAUTHORIZED` | HTTP 401, Match | ✅ Pass |
| **Webhook** | `positive: valid signature processes webhook` | HTTP 200, JSON acknowledged | HTTP 200, Match | ✅ Pass |

## 7. Services (Isolated)

| Suite | Description & Path | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Docs Svc** | `createPresignedUrl: rejects file size over tier limit` | Throws "File size exceeds..." | AppError thrown | ✅ Pass |
| **Docs Svc** | `createPresignedUrl: rejects if upload quota is exceeded` | Throws "Upload limit exceeded" | AppError thrown | ✅ Pass |
| **Docs Svc** | `createPresignedUrl: valid payload` | Returns presigned URL and DB entry | Presigned URL | ✅ Pass |
| **Docs Svc** | `confirmUpload: rejects missing DB record` | Throws "Document not found" | AppError thrown | ✅ Pass |
| **Docs Svc** | `confirmUpload: rejects missing S3 file` | Throws "File not found" or "Failed to communicate" | AppError thrown | ✅ Pass |
| **Docs Svc** | `confirmUpload: returns early if confirmed` | Returns success immediately | Returned early | ✅ Pass |
| **Docs Svc** | `deleteDocument: rejects if document not found in DB`| Throws "Document not found" | AppError thrown | ✅ Pass |
| **Docs Svc** | `deleteDocument: deletes document and chunks...` | Returns success, DB empty | DB empty | ✅ Pass |
| **Docs Svc** | `listDocuments: returns array of documents` | Returns documents for tenant | Returned array | ✅ Pass |
| **Docs Svc** | `getDocumentPreview: rejects if not found` | Throws "Document not found" | AppError thrown | ✅ Pass |
| **Docs Svc** | `getDocumentPreview: returns presigned GET URL` | Returns URL & 43200 expiry | Returned URL | ✅ Pass |
| **Auth Svc** | `registerUser: successful registration` | DB logged, Returns success | DB inserted | ✅ Pass |
| **Auth Svc** | `registerUser: rejects duplicate` | Throws "Account already registered"| AppError thrown | ✅ Pass |
| **Auth Svc** | `loginUser: rejects unverified user` | Throws "Invalid email or password" | AppError thrown | ✅ Pass |
| **Auth Svc** | `forgetPassword: processes for existing` | logContext gets "forget_password_success"| Log matched | ✅ Pass |
| **Auth Svc** | `forgetPassword: ignores non-existent` | logContext gets "forget_password_user_not_found"| Log matched | ✅ Pass |
| **Auth Svc** | `verifyEmail: rejects invalid or expired tokenHash`| Throws "Invalid or expired verification link."| AppError thrown | ✅ Pass |
| **Auth Svc** | `getProfile: returns profile & untouched tier`| Returns valid `PRO` tier | Tier unchanged | ✅ Pass |
| **Auth Svc** | `getProfile: lazy downgrades expired tier`| Downgrades DB to `FREE` + logEvent | DB matches | ✅ Pass |
| **Auth Svc** | `getProfile: throws NOT_FOUND if no user` | Throws "User not found" | AppError thrown| ✅ Pass |
| **OAuth Svc**| `initiateOAuth: returns valid Google URL` | Returns URL with `provider=google` | Match string | ✅ Pass |
| **OAuth Svc**| `initiateOAuth: returns valid GitHub URL` | Returns URL with `provider=github` | Match string | ✅ Pass |
| **OAuth Svc**| `handleOAuthCallback: throws missing code` | Throws "Missing authorization code" | AppError thrown | ✅ Pass |
| **OAuth Svc**| `handleOAuthCallback: throws invalid code` | Throws "OAuth code exchange failed" | AppError thrown | ✅ Pass |
| **Search Svc**| `executeHybridSearch: valid query` | Returns FTS & Vector matched data | Valid array returned | ✅ Pass |
| **Search Svc**| `executeHybridSearch: LLM failure` | Gracefully degrades to return FTS only| Valid array returned | ✅ Pass |
| **Search Svc**| `executeHybridSearch: throws error if search tier quota is exceeded` | Throws "Search limit exceeded" | AppError thrown | ✅ Pass |
| **RAG Svc** | `streamChat: throws error if prompt injection is detected` | Throws "Input rejected: Detected..." | AppError thrown | ✅ Pass |
| **RAG Svc** | `streamChat: throws error if Q&A tier quota is exceeded` | Throws "Q&A limit exceeded." | AppError thrown | ✅ Pass |
| **RAG Svc** | `updateConversationTitle: updates conversation title successfully` | Updates DB title | DB matches | ✅ Pass |
| **RAG Svc** | `updateConversationTitle: throws 404 if conversation does not exist or wrong tenant`| Throws "Conversation not found" | AppError thrown | ✅ Pass |
| **RAG Svc** | `deleteConversation: throws 404 if conversation does not exist` | Throws "Conversation not found" | AppError thrown | ✅ Pass |
| **RAG Svc** | `deleteConversation: deletes conversation successfully` | Deletes from DB | DB matches | ✅ Pass |
| **Payments Svc**| `createCheckoutSession: positive creates transaction` | Returns `checkoutUrl`, `sessionId`, inserts DB | DB matched | ✅ Pass |
| **Payments Svc**| `createCheckoutSession: negative rejects invalid tier` | Throws "Invalid tier to unlock" | AppError thrown | ✅ Pass |
| **Payments Svc**| `createCheckoutSession: negative rejects missing tenant`| Throws "Tenant not found" | AppError thrown | ✅ Pass |
| **Payments Svc**| `createCheckoutSession: negative rejects SIMULATE twice in month`| Throws "You can only claim the SIMULATE..." | AppError thrown | ✅ Pass |
| **Payments Svc**| `createCheckoutSession: negative stripe error` | Throws "Failed to communicate with Stripe" | AppError thrown | ✅ Pass |
| **Payments Svc**| `handleWebhook: positive checkout.session.completed` | Updates Trx status to SUCCEEDED and upgrades tier| DB matched | ✅ Pass |
| **Payments Svc**| `handleWebhook: negative ignores unknown transaction` | Returns `acknowledged`, `unknown_transaction` | Matched | ✅ Pass |
| **Payments Svc**| `handleWebhook: positive downgrades sub on deleted` | Tier updated to `FREE`, expiresAt to null | DB matched | ✅ Pass |
| **Payments Svc**| `createPortalSession: positive creates portal session` | Returns `portalUrl` | Matched URL | ✅ Pass |
| **Payments Svc**| `createPortalSession: negative rejects if no stripe_cust`| Throws "No active Stripe customer found" | AppError thrown | ✅ Pass |

---
*Report auto-generated after applying BDD refactoring and strict isolation testing.*
