# Landing Demo — Chat UI & EmailShell (2026-08-31)

**Completion Timestamp:** 2026-08-31 16:30 UTC+7  
**Commit:** `c8ef73a`

## Core Logic

Demo landing (`DemoSection.svelte`) direwrite dari visualisasi vektor statis ke **chat UI ter-simulate** yang merepresentasikan RAG flow Dokyudo end-to-end (Svelte 5 runes + SSE stream tiruan). Bersamaan dengan itu `landing.css` dirapikan dan `landing-init.ts` disederhanakan; token visual tetap dari `DESIGN.md`.

### Perubahan `landing.css` (`apps/frontend/src/lib/assets/landing.css`)

- Dihapus duplikasi `hero` / ticker / capability panel lama; disisakan token inti (`--color-*`, `--font-*`, `--ease`, `--r-ctl`, `--s-contain`).
- Demo visual kini 100% di `DemoSection.svelte` (chat bubble, typing indicator, source refs) bukan SVG radial graph yang berat.

### `DemoSection.svelte` (`apps/frontend/src/lib/components/landing/DemoSection.svelte:1`)

- Svelte 5 runes (`$state`, `$derived`) + `onMount` untuk simulasi SSE: `setInterval` memancarkan token jawaban, update `answer`, `chunks`, `latency` secara incremental (mirip `rag-streaming-and-history`).
- UI: `ChatInput` kapsul glass, bubble user/assistant, pill status (`complete / streaming`), `SourceReferences` dengan citation chip, tanpa ketergantungan backend riil — cocok untuk landing statis.
- Aksesibilitas & motion: menghormati `prefers-reduced-motion`, transform/opacity only (`200ms cubic-bezier(0.37,0,0.63,1)`).

### `landing-init.ts` (`apps/frontend/src/lib/components/landing/landing-init.ts`)

- Inisialisasi scroll-trigger / GSAP yang tidak terpakai dihapus (118 baris → ringkas); demo tidak lagi butuh orchestrator global.

### `TestimonialsSection.svelte`

- Penyesuaian 10 baris untuk tipografi yang selaras dengan chat demo baru.

## File Mapping

- `apps/frontend/src/lib/assets/landing.css` — token visual (tidak lagi bloat hero/ticker).
- `apps/frontend/src/lib/components/landing/DemoSection.svelte` — chat UI + SSE tiruan.
- `apps/frontend/src/lib/components/landing/landing-init.ts` — init ringkas.
- `apps/frontend/src/lib/components/landing/TestimonialsSection.svelte` — polish tipografi.

## Connections

- `docs/backend/rag-streaming-and-history.md` — SSE riil yang di-simulate landing.
- `docs/backend/email-template-system.md` — `emailShell` berbagi token landing yang sama (konsistensi brand email ↔ landing).
