# Frontend Simple Logging Policy

## Activation
- **Method**: Always On
- **Files**: `apps/frontend/**/*.svelte`, `apps/frontend/**/*.ts`

---

## 1. Simple Trace Logging over Wide Events
While the Deno Backend uses the structured "Wide Event" pattern for system observability and Loki ingestion, the SvelteKit frontend must prioritize pure Developer Experience (DX) in the browser console.

Do **NOT** implement complex logger utilities or "Wide Events" on the frontend unless specifically asked by the user. 

Instead, log raw lifecycle states explicitly using standard `console.log()` to help developers track exactly what is leaving the client and what is returning.

## 2. The Form Submission Contract
When handling Svelte form submissions (e.g., inside `onUpdate` for `sveltekit-superforms` or standard `onsubmit` handlers), you **MUST** track the precise lifecycle by logging two things:

1. **The Outbound Payload**: Log the raw user input (including sensitive fields like passwords, as this is restricted to the developer's local browser context) right before the `fetch` or API client executes.
2. **The Inbound Response**: Log the exact raw response (or error payload) received from the backend immediately after the request finishes.

### ✅ Correct Pattern:
```typescript
onUpdate: async ({ form: f }) => {
    // 1. Log exact frontend state before sending
    console.log('[Auth Login] Form Submitted:', { 
        email: f.data.email, 
        password: f.data.password 
    });

    try {
        const result = await authLogin(f.data);
        
        // 2. Log exact backend response
        console.log(`[Auth Login] Backend Response:`, result);
    } catch (err) {
        console.error('[Auth Login] Catch Error:', err);
    }
}
```

## 3. Formatting Convention
Always prefix frontend logs with the context bracket (e.g., `[Auth Login]`, `[Dashboard Data]`) to make them easily searchable and visually distinct in Chrome/Firefox DevTools.
