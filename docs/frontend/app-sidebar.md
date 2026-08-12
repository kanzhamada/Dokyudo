# App Sidebar UI Architecture

## Core Logic
The App Sidebar feature provides the primary navigation structure for the Dokyudo application. It features a responsive, collapsible sidebar built with Svelte 5 and shadcn-svelte. The sidebar intelligently switches to a hidden state on mobile devices, relying on a dedicated `MobileHeader` with a hamburger menu to trigger its visibility. It includes interactive elements like truncated tooltips for long chat titles, icon-only collapsible modes, and hover-triggered dropdown actions.

## Flow Diagram

```mermaid
graph TD
    A[App Layout `+layout.svelte`] --> B(Sidebar.Provider)
    B --> C[AppSidebar `AppSidebar.svelte`]
    B --> D[MobileHeader `MobileHeader.svelte`]
    
    D -->|md:hidden| E[Hamburger Button]
    E -->|onClick| F[useSidebar.toggle]
    F --> C
    
    C --> G[Desktop View]
    G -->|Collapsible| H[Icon Only Mode]
    H -->|Hover over Logo| I[Expand Sidebar]
    
    C --> J[Svelte 5 Snippets]
    J --> K[navItem]
    J --> L[recentChatItem]
```

## Account Panel Dialog (Unified)

Sejak 2026-08-12, Settings, Billing, Shared Links, dan Configure BYOK digabung menjadi **satu dialog panel** dengan side tab.

- **`apps/frontend/src/lib/components/app/AccountPanelDialog.svelte`**: dialog tunggal (glassy `#242322/85`, `sm:max-w-[880px] lg:max-w-[940px]`) dengan tab rail di kiri (`w-52`) dan panel konten di kanan. Di mobile rail berubah jadi bar horizontal scroll di atas konten.
- **Tinggi konsisten & scrollable**: area panel memakai tinggi tetap `h-[70vh]` (mobile) / `h-[600px]` (desktop); header + rail statis, konten tiap tab scroll sendiri (`overflow-y-auto`). Semua tab punya tinggi yang sama.
- **Tab yang tersedia**:
  - `settings` — display name (`PATCH /api/auth/tenant/name`) + ganti password (`PUT /api/auth/update-password`, schema `profilePasswordSchema`).
  - `billing` — usage (`GET /api/me/usage`) dengan limit dari `TIER_LIMITS`, countdown reset bulanan realtime (FREE) atau `expiresAt` + tombol `Manage billing` (`POST /api/payments/portal`), pricing plans dari `TIER_PLANS`, checkout Sandbox (`POST /api/payments/checkout`).
  - `shared-links` — daftar link aktif (`GET /api/rag/shares`), search, group by conversation, delete/revoke/copy.
  - `byok` — Configure BYOK (Google AI / Mistral / OpenRouter), save/reset key (`upsertKey`/`deleteKey`), masked key state.
- **State bersama**: `apps/frontend/src/lib/state/account-panel.store.svelte.ts` mengekspos `accountPanel` (`$state` berisi `open`, `tab`, `byokSavedAt`) + helper `openAccountPanel(tab)`, `closeAccountPanel()`, `markByokSaved()`. Halaman mana pun (mis. `/app/chat` tombol *configure*) bisa membuka panel dengan tab aktif tertentu.
- **Refresh BYOK**: setelah key disave/reset, `markByokSaved()` menaikkan `byokSavedAt`; halaman chat me-refresh `llmOptions` via `$effect` yang mengamati nilai tersebut.
- **Auto-open**: redirect dari payment success ke `/app?billing=open` membuka panel langsung di tab `billing`.
- Menu profile footer (Settings / Billing / Shared links / Log out) kini memanggil `openAccountPanel(...)` alih-alih tiga dialog terpisah.

## Completion Timestamp
**Completed At:** 2026-06-21T21:25:35+07:00 (diperbarui 2026-08-12: unified Account Panel)

## File Mapping
* **`apps/frontend/src/routes/app/+layout.svelte`**
  * Serves as the main layout wrapper, rendering the `Sidebar.Provider`, the `AppSidebar`, and the new `MobileHeader`.
* **`apps/frontend/src/lib/components/app/AppSidebar.svelte`**
  * The core navigation component. Extensively refactored to use Svelte 5 snippets (`#snippet navItem`, `#snippet recentChatItem`) for DRY architecture. Uses Tailwind classes mapped to central CSS variables. Menu profile membuka `AccountPanelDialog` via `account-panel.store`.
* **`apps/frontend/src/lib/components/app/AccountPanelDialog.svelte`**
  * [NEW] Unified account panel (Settings / Billing / Shared links / BYOK) dengan side tab dan tinggi konsisten scrollable.
* **`apps/frontend/src/lib/state/account-panel.store.svelte.ts`**
  * [NEW] Shared state untuk membuka panel dari komponen/page mana pun.
* **`apps/frontend/src/lib/components/app/MobileHeader.svelte`**
  * [NEW] A mobile-exclusive (`md:hidden`) top navigation bar that contains a hamburger menu (triggering `sidebar.toggle()`) and the Dokyudo logo.
* **`apps/frontend/src/routes/layout.css`**
  * Modified to include global design tokens for the sidebar: `--sidebar-muted`, `--sidebar-muted-foreground`, and `--sidebar-avatar`, ensuring cohesive theming.

## Connections
This feature is entirely isolated to the SvelteKit **Frontend Layer**. It acts as the presentation shell for the application routes. Currently, the data (e.g., `recentChats`, `navItems`) is mocked locally within the component, but it is architected to eventually accept state from a backend store or SvelteKit `load()` function.

## Architectural Decisions
1. **Svelte 5 Snippets (`#snippet`)**: To resolve repetition in rendering navigation links and recent chats, Svelte 5 snippets were used instead of creating multiple small file components. This keeps the logic co-located while maintaining a clean, readable main HTML template.
2. **Tailwind v4 Design Tokens**: Arbitrary hex colors (e.g., `#1C1B1B`, `#C5937B`) were completely stripped from the markup. They were promoted to `--sidebar-*` custom CSS properties in `layout.css` and mapped via `@theme inline`. This enforces design consistency and allows for seamless dark/light mode scaling.
3. **Responsive Strategy**: Instead of forcing the `Sidebar.Trigger` into the main content slot, a dedicated `MobileHeader` component was created. This allows the mobile navbar to maintain a distinct layout (hamburger on left, logo on right) without cluttering desktop UI components.
4. **Strict Type-Safety**: The Svelte snippets were explicitly typed (e.g., `item: typeof navItems[0]`) to ensure the strict `svelte-check` compiler passed without implicit `any` errors.
