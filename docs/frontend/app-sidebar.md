# App Sidebar & Mobile Navigation Architecture

## Core Logic
The App Sidebar and Mobile Navigation feature provides the primary navigation structure and mobile app chrome for Dokyudo. It features a responsive, collapsible sidebar built with Svelte 5 and shadcn-svelte primitives. On mobile devices, the sidebar switches to a drawer state triggered by a reusable floating `MobileHeader` capsule.

Key enhancements and layer-management features:
- **Hierarchical Dropdown Layer Synchronization**: User profile and conversation action menus are powered by official `DropdownMenu` primitives (`$lib/components/ui/dropdown-menu`). Because both `DropdownMenu` and mobile `Sidebar` (`Sheet`) are built on `bits-ui`, the internal layer manager recognizes dropdown items as active nested child layers, preventing premature mobile drawer dismissals when selecting menu actions.
- **Reliable `onSelect` Execution**: Menu actions (Settings, Billing, Shared links, Log out, Share, Edit, Pin, Delete) execute cleanly via `onSelect` handlers without race conditions or click interception issues.
- **Auto-Dismiss Mobile Drawer on Navigation**: Selecting any navigation item or recent chat conversation automatically closes the mobile `Sheet` drawer.
- **Tactile Touch Feedback**: `-webkit-tap-highlight-color: rgba(255, 255, 255, 0.08)`, `-webkit-touch-callout: none`, `user-select: none`, and `active:scale` micro-press animations.
- **Unified Reusable MobileHeader**: Reusable `MobileHeader.svelte` with Svelte 5 snippet slots (`leading`, `center`, `trailing`, `bottom`), providing an identical floating shell (`fixed inset-x-4 top-4 z-50`, `rounded-[24px]`, `backdrop-blur-[42px]`) across `/app/chat`, `/app/chat/[id]`, and other views.

## Flow Diagram

```mermaid
graph TD
    A[App Layout `+layout.svelte`] --> B(Sidebar.Provider)
    B --> C[AppSidebar `AppSidebar.svelte`]
    B --> D[MobileHeader `MobileHeader.svelte`]
    
    subgraph Mobile Layer Architecture
        C -->|Mobile Viewport| E[Sheet.Content Drawer]
        E --> F[Sidebar.MenuItem]
        F --> G[DropdownMenu.Root]
        G --> H[DropdownMenu.Trigger]
        G --> I[DropdownMenu.Content z-70]
        I -->|User selects Item| J[bits-ui Layer Manager recognizes Child Layer]
        J -->|Sheet does NOT close prematurely| K[onSelect fires -> Action opens Dialog]
        K --> L[Dropdown closes itself cleanly]
    end

    subgraph Mobile Header Architecture
        D -->|Default Mode /chat| M[Leading: Hamburger | Trailing: Brand Logo]
        D -->|Room Mode /chat/:id| N[Leading: Hamburger + New Chat | Center: Title | Trailing: Share + Refs | Bottom: Drawers]
    end
```

## Completion Timestamp
**Completed At:** 2026-08-18 13:53:00

## File Mapping
* **`apps/frontend/src/lib/components/app/AppSidebar.svelte`**
  * Integrated shadcn-svelte `DropdownMenu` for User Account profile menu and Recent Chat conversation items.
  * Synchronized with mobile `Sheet` layer lifecycle to guarantee action execution on mobile touch devices.
  * Cleaned up manual coordinate math, manual backdrops, and global window listeners.
* **`apps/frontend/src/lib/components/app/MobileHeader.svelte`**
  * Reusable floating header component with Svelte 5 snippets (`leading`, `center`, `trailing`, `bottom`, `children`), glassmorphism styling, and touch feedback rules.
* **`apps/frontend/src/routes/app/chat/[id]/+page.svelte`**
  * Integrated `<MobileHeader>` and snippet slots, applying active touch animations across all navbar buttons.
* **`apps/frontend/src/routes/app/+layout.svelte`**
  * Wraps the application shell, rendering the global `MobileHeader` on non-chat-room routes.
* **`apps/frontend/src/lib/components/app/AccountPanelDialog.svelte`**
  * Unified account panel dialog (Settings / Billing / Shared links / BYOK).

## Connections
* **Client UI Layer (`AppSidebar.svelte`, `MobileHeader.svelte`)**: Consumes `useSidebar` context to coordinate mobile drawer visibility.
* **Layer Hierarchy (`bits-ui` Layer Manager)**: Coordinates `Sheet.Content` and `DropdownMenu.Content` focus trapping and event containment.
* **Navigation State (`$page.url.pathname`, `goto`)**: Synchronizes active states, URL updates, and auto-dismisses mobile drawers upon navigation.
* **Cache & Optimistic Store (`conversationsStore`, `me-cache.store`)**: Powers instant list manipulation, pin toggles, and profile initials.

## Architectural Decisions
1. **`DropdownMenu` Primitives over Custom Teleport & Backdrops**:
   Custom teleported overlays rendered directly into `document.body` sit outside the mobile `Sheet.Content` DOM tree. When a user clicked a menu item, the parent `Sheet` treated the click as an outside tap and immediately dismissed the sidebar while leaving the floating menu orphaned. Standard `DropdownMenu` integrates directly with `bits-ui`'s hierarchical layer manager, correctly associating the dropdown as a child of the active `Sheet`.
2. **`onSelect` Callback Pattern**:
   Using `onSelect` on `<DropdownMenu.Item>` guarantees that menu items execute their business logic before the popover layer teardown occurs, avoiding race conditions between click propagation and element unmounting.
3. **Svelte 5 Snippets for Reusable Header**:
   Using snippet slots (`leading`, `center`, `trailing`, `bottom`) allowed `MobileHeader.svelte` to remain the single source of truth for floating geometry while accommodating room-specific action sets.
