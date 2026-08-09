# Chat Assistant Interface (`/app/chat`)

## Core Logic
The `/app/chat` route houses the core chat and semantic search interface for the Dokyudo platform. It provides a highly responsive, glassmorphic UI where users can toggle between conversing with language models ("Chat" mode) and searching their knowledge base ("Search" mode). 

Key features implemented include:
- **Glassmorphic Aesthetics**: Frosted glass capsules (`backdrop-blur-[42px]`) with transparent borders and subtle white opacities.
- **Dynamic File Attachment**: Users can attach documents (PDF, TXT, DOCX), which render as dynamic, removable chips inside the capsule.
- **Strict Client-Side Quota Enforcement**: Real-time validation preventing users from exceeding the 5-file upload limit, 5GB storage limit, and the 25MB per-file size limit via `svelte-sonner` toast error messages.
- **Layered Delta Usage Trackers**: Visual progress indicators (circular SVGs on desktop, linear bars on mobile) that use a 3-layer approach (Background, Amber Delta, White Base) to instantly preview how much storage/quota the currently attached files will consume before sending.
- **Container-Query Responsiveness**: Replaced standard viewport breakpoints (`md:`) with native Tailwind v4 Container Queries (`@container`, `@3xl`), allowing the massive Desktop Usage Capsule to flawlessly downgrade to a sleek mobile dropdown strictly based on the container's available width—elegantly handling dynamic space stealing from the collapsible `AppSidebar`.
- **Mode Toggle & Reactivity**: The entire bottom control row utilizes a heavily customized `shadcn-svelte` Tabs component mapped directly to `activeMode`. Selecting "Search" automatically hides unnecessary components (like the LLM model selector) to maximize input real estate.

## Flow Diagram

```mermaid
graph TD
    User([User]) -->|Selects Mode| Tabs[shadcn Tabs Toggle]
    Tabs -->|Update activeMode| UI[Reactive UI Layout]
    
    UI -->|If 'Chat'| ModelSelector[Show LLM Selector]
    UI -->|If 'Search'| HideSelector[Hide Selector & Expand Input]

    User -->|Attaches File| FileInput[File Input Event]
    FileInput --> Validation{Quota Check}
    Validation -->|> 25MB| Toast[Sonner Toast Error]
    Validation -->|> 5 Uploads Max| Toast
    Validation -->|> 5GB Storage| Toast
    Validation -->|Valid| State[Update attachedFiles Array]

    State --> Chips[Render File Chips inside Capsule]
    State --> Visuals[Update Delta Usage Indicators]

    Visuals --> Desktop[SVG Ring Delta Update]
    Visuals --> Mobile[Linear Bar Delta Update]
```

## Completion Timestamp
**Date Completed**: 2026-06-21T20:27:00+07:00

## File Mapping
- **`apps/frontend/src/routes/app/chat/+page.svelte`**: The monolithic view housing the Chat Interface container, glassmorphic capsule, dynamic usage indicators, Svelte 5 `$derived` state, and Svelte-Sonner integration.
- **`apps/frontend/src/lib/components/ui/tabs/*`**: Added `shadcn-svelte` Tabs component.
- **`apps/frontend/src/lib/components/ui/sonner/*`**: Added `shadcn-svelte` Sonner toast component.

## Connections
- **Sidebar Integration**: The UI responds intrinsically to the `AppSidebar` width via `@container`. No direct prop drilling of sidebar state is needed.
- **Backend Coupling (Future)**: The state variables (`baseUploads`, `baseStorageBytes`, `maxUploads`, `maxStorage`) are currently hardcoded mock data, but they are deliberately isolated inside `$derived` reactivity blocks so they can seamlessly bind to real API data coming from the user's `@hono/zod-openapi` session context.

## Architectural Decisions
1. **SVG Layering vs. JS Math**: Instead of calculating the exact pixel gap for the amber progress bar, we stacked three separate SVG tracks (or HTML div bars for mobile) via Z-index. The white "base usage" ring is painted on top of the amber "total usage" ring. Because the amber ring is strictly larger, the delta logically sticks out—creating a brilliant visual effect without complex math.
2. **Container Queries over Sidebar State**: Relying on the `AppSidebar`'s `useSidebar().state` to manually toggle CSS classes is brittle. By wrapping the chat bottom row in `@container`, the layout relies purely on the browser's rendering engine to detect if the desktop capsule will fit (`@3xl`), allowing flawless scaling on any device or sidebar state.
3. **Data Attributes for Tabs**: Rather than fighting the default shadcn-svelte classes, the `Tabs.Trigger` components use `data-[state=active]` and `data-[state=inactive]` to precisely inject the complex glassmorphic Tailwind classes.

---

## Iteration 2 — Reusable ChatInput + Model Selection Unification (2026-08-09)

### 1. Input capsule di-extract ke `ChatInput.svelte`

Kapsul input chat (file chips, attach + quota tooltip, textarea auto-resize, model dropdown, tombol send/stop) dipindah ke komponen shared `apps/frontend/src/lib/components/chat/ChatInput.svelte`, dipakai oleh **kedua** halaman (`/chat` dan `/chat/[id]`).

- Props `$bindable`: `value`, `attachedFiles`, `selectedModel`; plus `llmOptions`, `placeholder`, `showModelSelector`, `isGenerating`, `transparent`, `onsend`/`onstop`, `onconfigure`, `refocusKey`, dan batas kuota (`baseUploads`, `maxUploads`, `baseStorage`, `maxStorage`, `maxFileSizeBytes`).
- Validasi file (ekstensi PDF/TXT/DOCX, ukuran per-file, kuota upload/storage) kini di dalam komponen — dipindah dari kedua halaman (logika identik).
- `refocusKey` memicu focus ulang textarea (dipakai `/chat` saat toggle mode chat/search); focus otomatis saat mount.
- Varian tampilan lewat prop **`transparent`**:
  - `true` (halaman `/chat`): kapsul `bg-[#232323]/[0.40]` tanpa shadow, tombol send transparan (`bg-[#B8B5B5]/[0]`), textarea `text-white/[0.40]` — mempertahankan warna asli halaman index.
  - `false` (default, `/chat/[id]`): kapsul `bg-[#232323]/[0.85] shadow-2xl`, tombol send `bg-white/10` + stop/disabled.

### 2. Model selection `/chat` sama persis dengan `/chat/[id]`

- Halaman `/chat` kini melempar `onconfigure={openConfigureDialog}` → ChatInput merender dropdown **rich** (search + grup model + item Configure), bukan flat list lagi.
- `ConfigureByokDialog.svelte` (komponen reusable, diextract dari `/chat/[id]`) dipasang di `/chat`: tab provider (Google AI/Mistral/OpenRouter), masked-key "API Key Configured", save/reset, `onSaved` → refresh `llmOptions`.
- Loading model disamakan: `Free Auto` memakai `free.svg`, hanya provider BYOK (gemini/mistral/openrouter) yang dimuat ke dropdown.

### 3. Ukuran & posisi input disamakan dengan `/chat/[id]`

- Container input: `max-w-6xl` → `max-w-4xl`, `bottom-12` → `bottom-4`, `gap-4` → `gap-3` — identik dengan posisi/lebar kapsul di halaman detail.

### 4. View Transitions (submit chat, tanpa flick, di bawah sidebar)

- `onNavigate` di `app/+layout.svelte` membungkus navigasi dengan `document.startViewTransition` **hanya untuk submit** (`navigation.type === 'goto'` dari `/app/chat` ke `/app/chat/<id>`). Navigasi lain (sidebar, detail→index, /chat→halaman lain) tanpa transisi.
- CSS di `src/routes/layout.css`:
  - `::view-transition-old/new(root)` → `animation: none` — sidebar & chrome aplikasi statis.
  - `::view-transition-old/new(app-main)` → crossfade 700ms pada `<main>` (tagged `view-transition-name: app-main`) — hanya area konten di bawah sidebar yang memudar.
  - Kapsul input **tidak** diberi `view-transition-name` sendiri: ia ikut capture `app-main` sebagai satu kesatuan. Capture terpisah (`chat-input`) sebelumnya membuat "lubang" persegi di snapshot `app-main` yang memunculkan artefak sudut tajam saat morph — dihapus.
- Fade `isMounted` (opacity transition) di halaman detail **dihapus** — beradu dengan view transition dan bikin input berkedip.

### 5. File Mapping

| File | Change |
|---|---|
| `apps/frontend/src/lib/components/chat/ChatInput.svelte` | Komponen baru: kapsul input + validasi file + dropdown model (rich/flat) + tombol send/stop + `transparent` |
| `apps/frontend/src/lib/components/chat/ConfigureByokDialog.svelte` | Komponen baru: dialog Configure BYOK reusable (provider, masks, save/reset, `onSaved`) |
| `apps/frontend/src/routes/app/chat/+page.svelte` | Pakai ChatInput (+`transparent`), onconfigure, ConfigureByokDialog; loading model BYOK; container 4xl/bottom-4 |
| `apps/frontend/src/routes/app/chat/[id]/+page.svelte` | Pakai ChatInput + ConfigureByokDialog; state/fungsi configure & file dipindah ke komponen |
| `apps/frontend/src/routes/app/+layout.svelte` | `onNavigate` view transition (submit-only) + `view-transition-name: app-main` |
| `apps/frontend/src/routes/layout.css` | `::view-transition-*` root:none + app-main crossfade 700ms |

### 6. Completion Timestamp
**Iteration 2 (ChatInput reusable, model selection unified, view transitions submit-only):** 2026-08-09
