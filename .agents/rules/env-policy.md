---
trigger: always_on
---

# Environment Variables & Envcrypt Policy

This rule enforces the correct initialization and usage of encrypted environment variables via `envcrypt` across the hybrid architecture of this project: Deno 2.x (Backend) and Node.js/SvelteKit (Frontend).

## Activation
- **Method**: Always On (or Model Decision when modifying `.env`, backend entry points, or SvelteKit server files).
- **Files**: `src/hooks.server.ts`, `main.ts`, `deno.jsonc`, `+page.server.ts`, `+layout.server.ts`

---

## 1. Deno Backend Conventions (Hono / Microservices)

Deno handles npm packages differently and isolates environment variables via `Deno.env`. However, because `envcrypt` is an npm package, decrypted values are injected into Node's compatibility layer (`process.env`).

### Rules for Deno:
1. Always import `loadFromConfig` using the `npm:` specifier unless mapped in `deno.jsonc`.
2. Always import `process` from `node:process` to access the decrypted values.
3. Call `loadFromConfig(".env")` at the absolute top of the main entry point (e.g., `main.ts`).

### Correct Deno Implementation Pattern:
```typescript
import { loadFromConfig } from "npm:envcrypt";
import process from "node:process";

// Initialize envcrypt at runtime boot
loadFromConfig(".env");

// Access variables via Node compatibility layer
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing!");
}

```

---

## 2. SvelteKit Frontend Conventions (Node.js Runtime)

SvelteKit runs on Node.js in production. Because `envcrypt` decrypts variables dynamically at runtime, SvelteKit's static environment imports (`$env/static/private`) will **not** capture them. You must rely on runtime evaluation.

### Rules for SvelteKit:

1. Initialize `envcrypt` inside `src/hooks.server.ts` so it executes once on server startup before any request or page load occurs.
2. Read the variables using standard Node `process.env` within server-only contexts (`+page.server.ts`, `+layout.server.ts`, or `+server.ts`).
3. Never expose these secrets to client-side files (`+page.svelte`).

### Correct SvelteKit Implementation Pattern:

**In `src/hooks.server.ts`:**

```typescript
import type { Handle } from '@sveltejs/kit';
import { loadFromConfig } from 'envcrypt';

// Initialize before SvelteKit handles any requests
loadFromConfig('.env');

export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event);
};

```

**In `src/routes/app/+page.server.ts`:**

```typescript
import type { PageServerLoad } from './$types';
import process from 'node:process'; // or access globally via process.env

export const load: PageServerLoad = async () => {
    // Correctly fetch the decrypted runtime value
    const apiGatewayUrl = process.env.INTERNAL_API_GATEWAY_URL; 
    
    return {
        apiGatewayUrl
    };
};

```

---

## 3. General Security Constraints

* Never commit unencrypted raw text values to `.env` if they are sensitive.
* When generating new configuration keys, automatically append the `encrypted:` prefix if you mock any encrypted string data.

```

---