# Document Library: PDF Viewer & Dynamic Architecture

## UPDATE (2026-08-13) — DOCX preview via converted PDF

Dokumen non-PDF (`.docx`) kini dirender di `PdfPreviewPanel` yang sama: STB Worker mengonversi file ke PDF saat ingestion (LibreOffice headless) dan menyimpannya sebagai `{tenant}/{docId}.pdf`; `GET /{id}/preview` (mode view) mengembalikan presigned URL PDF konversi tersebut. Viewer (EmbedPDF/PDFium) tidak berubah sama sekali. `download=true` tetap mengunduh file asli `.docx`. Kutipan chat dengan lompat halaman bekerja pada PDF konversi (metadata `pages` chunk dihasilkan dari PDF yang sama).

## Core Logic
This feature refactors the Document Library dashboard (`/app/documents`) to transition from hardcoded dummy data to a dynamic file-loading architecture. It also vastly improves the UI/UX by implementing a split-pane layout using `shadcn-svelte/resizable`, seamlessly embedding `@embedpdf/svelte-pdf-viewer` matched to the Dokyudo design system, and providing a specialized mobile full-screen view. Additionally, it implements a custom sorting algorithm for the TanStack Table "Size" column, ensuring strings like "333 KB" and "1.5 MB" sort correctly by their true byte size.

## Completion Timestamp
**Date**: 2026-06-23 15:24:00

## Flow Diagram
```mermaid
flowchart TD
    A[SvelteKit SSR Load] -->|Reads /static/documents| B(+page.server.ts)
    B -->|Extracts Stats: Size, mtime| C(Documents Array)
    C -->|Passes PageData| D(+page.svelte)
    D --> E[TanStack Data Table]
    
    subgraph UI Layout
    E --> F{Resizable Pane Group}
    F -->|Pane 1| G[Document List]
    F -->|Pane 2| H[PDF Viewer]
    end
    
    H -->|Themed via ThemeColors| I(@embedpdf)
```

## File Mapping
- **Modified**: `apps/frontend/src/routes/app/documents/+page.svelte` (Layout, Tooltips, snippet refactor, Resizable integration)
- **Modified**: `apps/frontend/src/routes/app/documents/data.ts` (Removed hardcoded array, kept TypeScript interfaces)
- **Created**: `apps/frontend/src/routes/app/documents/+page.server.ts` (Node.js script to dynamically read `static/documents`)
- **Modified**: `apps/frontend/src/routes/app/documents/columns.ts` (Injected custom `sortingFn` for the size column to parse KB/MB)
- **Modified**: `apps/frontend/src/routes/app/documents/document-card-actions.svelte` (Added `onPreview` callback support)

## Connections
- **Frontend -> Server**: SvelteKit's `+page.server.ts` operates on the Node.js layer during the initial page load to query the local `static/documents` folder using `node:fs`. It returns the hydrated array to `+page.svelte` via the `$props().data` Svelte 5 rune.
- **Table Integration**: The `createSvelteTable` component now consumes `data.documents` from the server load instead of importing a static constant.

## Architectural Decisions
1. **Dynamic Static Loading vs DB**: Since the user explicitly requested dynamic loading but DB infrastructure isn't strictly defined for this specific upload component yet, we leverage Node's `fs.readdirSync` inside `+page.server.ts` targeting `/static/documents`. This provides immediate local feedback when developing or dropping files.
2. **`shadcn-svelte/resizable`**: Chosen over custom flex/CSS dragging logic to guarantee keyboard accessibility (A11y) and built-in local storage persistence for pane sizes (`autoSaveId`).
3. **Dokyudo Themed PDF Viewer**: The `@embedpdf` viewer is customized deeply using its `ThemeColors` object mapping `#191919` app backgrounds, `#DB8F5E` primary accents, and subtle `rgba(255, 255, 255, 0.05)` borders to prevent visual dissonance in the dark mode UI.
4. **Mobile Layout Constraints**: To preserve scroll state when jumping between the document list and the PDF viewer on mobile, the `md:hidden` container utilizes conditional CSS classes (`class:hidden`) rather than Svelte `{#if}` blocks, ensuring the DOM tree remains intact.
5. **Tooltips Composition**: Because `shadcn-svelte` uses snippet blocks for triggers, the `Tooltip.Trigger` was organically wrapped around the existing `DropdownMenu.Trigger` using nested `{#snippet child({ props })}` structures to spread both event listeners accurately without DOM conflicts.
