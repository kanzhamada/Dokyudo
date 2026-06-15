---
trigger: always_on
description: Forces the AI to consult the curated reference library in `ai/learn/` as the primary knowledge source before falling back to internal knowledge or external URLs. Prevents hallucinated API usage and ensures implementations align with the exact library versions adopted by this project.
---

# Learn-First Lookup Policy

## Activation
- **Method**: Always On
- **Context**: Any implementation task, debugging session, or architectural decision where the AI is uncertain about syntax, API surface, configuration, or best practices for a technology used in this project.

---

## 1. The Lookup Hierarchy

When you are **unsure, confused, or need to verify** how a library, framework, or pattern works before writing code, you **must** follow this strict priority order:

### Priority 1 — `ai/learn/` (Local Curated References)

Search the `ai/learn/` directory **first**. These files contain the **exact documentation versions** adopted by this project. They are the single source of truth for API surfaces and patterns.

**Keyword-to-file mapping:**

| Keywords / Topic | File to Search |
|---|---|
| Hono, middleware, `c.body()`, `c.json()`, Hono routing, `createRoute`, OpenAPI | `ai/learn/hono.md` |
| Svelte, runes, `$state`, `$derived`, `$effect`, reactivity, components | `ai/learn/svelte.md` |
| SvelteKit, `+page.server.ts`, `load()`, hooks, routing, SSR, form actions | `ai/learn/sveltekit.md` |
| shadcn-svelte, UI components, Button, Dialog, Card, Table, form | `ai/learn/shadcn-svelte.md` |
| Deno, LLM, OpenAI SDK, Anthropic SDK, streaming, chat completions | `ai/learn/deno-llm.md` |
| RAG, retrieval augmented generation, embeddings, vector search, agent | `ai/learn/deno-rag.md` |
| Redis, RAG with Redis, vector store, caching patterns | `ai/learn/redis-rag.md` |
| Deno benchmarking, performance testing, `Deno.bench` | `ai/learn/deno-benchmarking.md` |

**How to search:**
- Use `grep_search` with relevant keywords against the specific file.
- If the file is large (e.g., `hono.md` at 350KB, `sveltekit.md` at 578KB), grep for the specific API or pattern name rather than reading the entire file.
- Read the relevant section(s) found by grep.

```
Example: Unsure how Hono handles SSE streaming?
→ grep_search("ReadableStream", "ai/learn/hono.md")
→ grep_search("streaming", "ai/learn/hono.md")
→ Read matching sections
→ Then implement
```

### Priority 2 — External URL References

If a reference URL is available and accessible (e.g., from a `ai/learn/` file's YAML frontmatter `url:` field, or from a PRD reference), you **may** open it using `read_url_content` or `browser_subagent` to verify current API details. This is especially useful for:
- Checking if an API has changed since the local docs were saved.
- Finding examples not covered in the local docs.
- Verifying npm package compatibility with Deno.

### Priority 3 — AI Internal Knowledge

If `ai/learn/` does **not** contain documentation for the specific topic (e.g., BullMQ internals, Drizzle ORM API, pgvector SQL syntax), use your internal training knowledge. Clearly note when you are relying on internal knowledge rather than local references.

---

## 2. When This Rule Activates

You **must** consult references before writing code in these situations:

| Situation | Example |
|---|---|
| **Unfamiliar API** | "How does Hono's `createRoute()` work with Zod?" → Search `hono.md` |
| **Framework-specific patterns** | "How do SvelteKit form actions work?" → Search `sveltekit.md` |
| **Component usage** | "What props does shadcn-svelte's `DataTable` accept?" → Search `shadcn-svelte.md` |
| **Deno + npm compatibility** | "How to import BullMQ in Deno?" → Search `deno-llm.md` for npm import patterns |
| **Streaming implementation** | "How to construct SSE in Hono?" → Search `hono.md` for streaming/SSE |
| **RAG pipeline patterns** | "How to structure a RAG agent?" → Search `deno-rag.md` and `redis-rag.md` |

---

## 3. Forbidden Behavior

- **Never guess** at an API signature when a local reference exists. Look it up.
- **Never assume** a component's props or a framework's method signature from memory alone when `ai/learn/` has the documentation.
- **Never skip** the lookup and write code that "probably works" — verify first.

---

## 4. Maintaining `ai/learn/`

When the user adds new reference files to `ai/learn/`, this rule automatically covers them. The keyword mapping in §1 should be treated as a guide, not an exhaustive list — if a file exists in `ai/learn/` and is relevant to the current task, search it.