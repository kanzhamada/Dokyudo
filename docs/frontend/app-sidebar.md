# App Sidebar & Mobile Navigation Architecture

## Core Logic
The App Sidebar and Mobile Navigation feature provides the primary navigation structure and mobile app chrome for Dokyudo. It features a responsive, collapsible sidebar built with Svelte 5 and shadcn-svelte primitives. On mobile devices, the sidebar switches to a drawer state triggered by a reusable floating `MobileHeader` capsule.

Recent enhancements introduce high-ergonomics mobile touch interactions:
- **Mobile Hold / Long-Press**: Holding a recent chat item for 500ms triggers tactile haptic feedback and displays the floating conversation action dropdown menu (Share, Edit, Pin, Delete). Moving finger > 8px cancels the timer to allow natural scrolling.
- **Auto-Dismiss Mobile Drawer**: Selecting any navigation item or recent chat immediately closes the mobile Sheet drawer.
- **Outside Tap / Empty Area Dismissal**: A global capture-phase `pointerdown` listener and full-screen backdrop immediately dismiss user profile and conversation action dropdown menus when tapping anywhere outside.
- **Ergonomic Touch Targets**: Expanded mobile button heights (`h-10` for nav, `h-9.5` for recent chats) and touch spacing (`gap-1.5`).
- **Tactile Touch Feedback**: `-webkit-tap-highlight-color: rgba(255, 255, 255, 0.08)`, `-webkit-touch-callout: none`, `user-select: none`, and `active:scale` micro-press animations.
- **Unified Reusable MobileHeader**: Refactored `MobileHeader.svelte` with Svelte 5 snippet slots (`leading`, `center`, `trailing`, `bottom`), providing an identical floating shell (`fixed inset-x-4 top-4 z-50`, `rounded-[24px]`, `backdrop-blur-[42px]`) across `/app/chat`, `/app/chat/[id]`, and other views.

## Flow Diagram

```mermaid
graph TD
    A[App Layout `+layout.svelte`] --> B(Sidebar.Provider)
    B --> C[AppSidebar `AppSidebar.svelte`]
    B --> D[MobileHeader `MobileHeader.svelte`]
    
    subgraph Mobile Gesture Pipeline
        E[Recent Chat Item] -->|TouchStart| F[Start 500ms Timer]
        F -->|TouchMove > 8px| G[Cancel Timer -> Scroll]
        F -->|TouchEnd < 500ms| H[Cancel Timer -> Navigate to Chat]
        F -->|500ms Elapsed| I[Haptic Vibrate -> Open Dropdown Menu]
        I -->|Tap Empty Area| J[Window PointerDown -> Dismiss Menu]
    end

    subgraph Mobile Header Architecture
        D -->|Default Mode /chat| K[Leading: Hamburger | Trailing: Brand Logo]
        D -->|Room Mode /chat/:id| L[Leading: Hamburger + New Chat | Center: Title | Trailing: Share + Refs | Bottom: Drawers]
    end
```

## Completion Timestamp
**Completed At:** 2026-08-17T22:20:00+07:00

## File Mapping
* **`apps/frontend/src/lib/components/app/MobileHeader.svelte`**
  * Refactored into a reusable floating header component with Svelte 5 snippets (`leading`, `center`, `trailing`, `bottom`, `children`), glassmorphism styling, and touch feedback rules.
* **`apps/frontend/src/lib/components/app/AppSidebar.svelte`**
  * Implemented mobile long-press detection (`handleItemTouchStart`/`handleItemTouchMove`/`handleItemTouchEnd`), global window `pointerdown` click-outside dismissal, auto-drawer closing on navigation, ergonomic sizing, and tap highlights.
* **`apps/frontend/src/routes/app/chat/[id]/+page.svelte`**
  * Replaced custom inlined header container with `<MobileHeader>` and snippet slots, applying active touch animations across all navbar buttons.
* **`apps/frontend/src/routes/app/+layout.svelte`**
  * Wraps the application shell, rendering the global `MobileHeader` on non-chat-room routes.
* **`apps/frontend/src/lib/components/app/AccountPanelDialog.svelte`**
  * Unified account panel dialog (Settings / Billing / Shared links / BYOK).

## Connections
* **Client UI Layer (`AppSidebar.svelte`, `MobileHeader.svelte`)**: Consumes `useSidebar` context to coordinate mobile drawer visibility.
* **Navigation State (`$page.url.pathname`, `goto`)**: Synchronizes active states, URL updates, and auto-dismisses mobile drawers upon navigation.
* **Cache & Optimistic Store (`conversationsStore`, `me-cache.store`)**: Powers instant list manipulation, pin toggles, and profile initials.

## Architectural Decisions
1. **Svelte 5 Snippets for Reusable Header**: Using snippet slots (`leading`, `center`, `trailing`, `bottom`) allowed `MobileHeader.svelte` to remain the single source of truth for floating geometry while accommodating room-specific action sets.
2. **Global Window Pointerdown Capture**: Instead of relying exclusively on transparent backdrop overlays (which can be trapped in CSS transform stacking contexts of mobile drawers), a window-level capture listener guarantees that clicking empty space or outside buttons dismisses open dropdowns reliably.
3. **Threshold-Based Long-Press Gesture**: A 500ms timeout coupled with an 8px touch delta check prevents conflict between vertical scrolling and hold gestures on touchscreens.
