# mx-icons Integration & Migration Guide

## Overview

Dokyudo uses **[mx-icons](https://www.npmjs.com/package/mx-icons) (`^1.1.1`)** as its icon library. mx-icons ships React components only, and Dokyudo's frontend is Svelte 5 — so the library is **not imported directly**. Instead, the SVG path data is extracted at build-prep time into a plain TypeScript data module, and rendered through a small Svelte wrapper that mirrors the lucide-svelte ergonomics (`size`, `class`, `currentColor`).

All new UI should use `MxIcon`. Legacy lucide-svelte usages are being migrated incrementally (see the migration checklist below).

## Architecture

```mermaid
graph LR
    A[mx-icons@1.1.1<br/>React components] -->|extract script| B[mx-icons-data.ts<br/>SVG paths + metadata]
    B --> C[MxIcon.svelte<br/>Svelte 5 wrapper]
    C --> D[App UI: sidebar, chat, documents, dialogs]
```

| File | Role |
| --- | --- |
| `apps/frontend/src/lib/components/icons/MxIcon.svelte` | Svelte wrapper. Accepts `name`, `size` (default 24), `class`, plus any extra attributes (`aria-hidden`, `data-icon`, ...). Color comes from `currentColor`, so Tailwind `text-*` / `hover:text-*` classes just work. |
| `apps/frontend/src/lib/components/icons/mx-icons-data.ts` | **Generated file — do not edit by hand.** Holds `MX_ICONS` (name -> `{ mode, strokeWidth?, paths }`) and the `MxIconName` union type. Also exports the `mxBoldName(name)` helper. |
| `mx-icons` (npm) | Source of the SVG data. React peer dependency is never used at runtime by Dokyudo. |

### Naming convention

Keys are the kebab-case of the mx-icons component name, lowercased:

| mx-icons component | `MxIcon` name |
| --- | --- |
| `ChatRoundLineLinear` | `chat-round-line-linear` |
| `DocumentUploadOutline` | `document-upload-outline` |
| `TrashBinMinimalisticBold` | `trash-bin-minimalistic-bold` |
| `Send1Outline` | `send1-outline` |
| `Logout3Bold` | `logout3-bold` |
| `Edit2Outline` | `edit2-outline` |

**Gotcha:** digits are not separated — `Send1Outline` is `send1-outline`, **not** `send-1-outline`. The extraction script generates these keys; always copy the key from the data file rather than guessing.

## Usage

```svelte
<script lang="ts">
	import MxIcon from '$lib/components/icons/MxIcon.svelte';
	import { mxBoldName } from '$lib/components/icons/mx-icons-data';
</script>

<!-- basic -->
<MxIcon name="document-outline" class="size-4" />

<!-- color via currentColor -->
<MxIcon name="trash-bin-minimalistic-outline" class="size-3.5 text-red-400" />

<!-- state-driven variant swap (active toggle) -->
{#if activeMode === 'chat'}
	<MxIcon name="chat-round-line-bold" class="size-4" />
{:else}
	<MxIcon name="chat-round-line-linear" class="size-4" />
{/if}

<!-- bold on hover (CSS-only, needs a group on an ancestor) -->
<span class="group-hover:hidden"><MxIcon name="send1-outline" class="size-5" /></span>
<span class="hidden group-hover:block"><MxIcon name="send1-bold" class="size-5" /></span>
```

## Adding a new icon

1. Confirm the component exists in the installed package:
   ```bash
   ls apps/frontend/node_modules/mx-icons/dist/components/<kebab-name>/
   ```
2. Run the extraction script with the new component name added to `WANTED` (see the script below — it is kept out of the repo and recreated per use; you can copy it from this guide).
3. Re-run it: it rewrites `mx-icons-data.ts` wholesale (all icons are extracted in one pass).
4. Use the generated kebab key in `name=...`.

```js
// scripts/extract-mx-icons.mjs — copy this into a temp file, add your icon to WANTED, run, then delete.
import fs from 'node:fs';
import path from 'node:path';

const WANTED = [
	'DocumentOutline',
	'ChatRoundLineLinear',
	// ...add the new component name (exact mx-icons export, e.g. 'ReceiptSearchBold')
];

const compDir = 'node_modules/mx-icons/dist/components';
const files = fs.readdirSync(compDir, { withFileTypes: true })
	.flatMap((d) => fs.readdirSync(path.join(compDir, d.name)).filter((f) => f.endsWith('.js'))
		.map((f) => path.join(compDir, d.name, f)));
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const out = {};
for (const name of WANTED) {
	const file = files.find((f) => path.basename(f, '.js') === name);
	if (!file) throw new Error(`missing component: ${name}`);
	const src = fs.readFileSync(file, 'utf8');
	const pathCalls = [...src.matchAll(/jsx\("path", \{([\s\S]*?)\}\)/g)];
	if (pathCalls.length === 0) throw new Error(`no paths found: ${name}`);
	const paths = pathCalls.map((m) => {
		const attrs = {};
		for (const a of m[1].matchAll(/(\w+): ("[^"]*")/g)) attrs[a[1]] = a[2].slice(1, -1);
		if (!attrs.d) throw new Error(`no d attr: ${name}`);
		return attrs;
	});
	const mode = paths.some((p) => p.stroke) ? 'stroke' : 'fill';
	const rootStrokeWidth = paths.find((p) => p.strokeWidth)?.strokeWidth;
	const inner = paths.map((p) => {
		const parts = [`d="${p.d}"`];
		if (mode === 'stroke') {
			if (p.strokeLinecap) parts.push(`stroke-linecap="${p.strokeLinecap}"`);
			if (p.strokeLinejoin) parts.push(`stroke-linejoin="${p.strokeLinejoin}"`);
			if (p.strokeWidth && p.strokeWidth !== rootStrokeWidth)
				parts.push(`stroke-width="${p.strokeWidth}"`);
		}
		return `<path ${parts.join(' ')} />`;
	}).join('');
	out[kebab(name)] = { mode, ...(rootStrokeWidth ? { strokeWidth: parseFloat(rootStrokeWidth) } : {}), paths: inner };
}

const lines = [
	'// Generated from mx-icons@1.1.1 (dist/components). Do not edit by hand.',
	'export interface MxIconDef { mode: \'stroke\' | \'fill\'; strokeWidth?: number; paths: string }',
	'',
	'export const MX_ICONS = {'
];
for (const [key, def] of Object.entries(out)) {
	lines.push(`\t${JSON.stringify(key)}: {`);
	lines.push(`\t\tmode: '${def.mode}',`);
	if (def.strokeWidth) lines.push(`\t\tstrokeWidth: ${def.strokeWidth},`);
	lines.push(`\t\tpaths: ${JSON.stringify(def.paths)}`);
	lines.push('\t},');
}
lines.push('} as const satisfies Record<string, MxIconDef>;');
lines.push('');
lines.push('export type MxIconName = keyof typeof MX_ICONS;');
lines.push('');

const dest = 'src/lib/components/icons/mx-icons-data.ts';
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, lines.join('\n'));
console.log(`wrote ${dest} with ${Object.keys(out).length} icons`);
```

Note: `mxBoldName` in the data file is hand-maintained logic (it rewrites the `outline`/`linear` suffix to `bold` and checks membership), so it survives regeneration untouched.

## Migrating lucide-svelte to MxIcon

### Step-by-step

1. **Find the usages.** Grep the component/page for the lucide import and JSX tags:
   ```bash
   grep -rn "from 'lucide-svelte'\|@lucide/svelte/icons" apps/frontend/src/<target>
   ```
   Watch out for aliased default imports (`import Trash2Icon from '@lucide/svelte/icons/trash-2'`) — the JSX tag may not match the bare lucide name.
2. **Map semantics, not names.** Use the semantic mapping table below. Pick the variant by state (see Variant conventions).
3. **Swap the tag.** Replace `<Paperclip class="size-5" />` with `<MxIcon name="attach-circle-outline" class="size-5" />`. Keep the same `class` — sizing and color classes are compatible.
4. **Remove the now-unused lucide import** and add `import MxIcon from '$lib/components/icons/MxIcon.svelte';`.
5. **Run `svelte-check`** and the production build before committing.

### Semantic mapping (already migrated)

| Semantics | mx-icons name(s) | Notes |
| --- | --- | --- |
| Chat | `chat-round-line-linear` / `chat-round-line-bold` | bold when active |
| Document / file | `document-outline` / `document-bold` | |
| Document uploads | `document-upload-outline` / `document-upload-bold` | |
| Storage / DB | `database-outline` / `database-bold` | |
| Attach | `attach-circle-outline` | no bold variant |
| Search | `receipt-search-outline` / `receipt-search-bold` | bold when search tab active |
| Send | `send1-outline` / `send1-bold` | bold on hover |
| Typing / keyboard | `devices-keyboard-outline` / `devices-keyboard-bold` | bold at char limit |
| Performance / usage | `diagram-up-bold` | bold-only icon |
| Settings | `settings-settings-outline` / `settings-settings-bold` | |
| Billing | `card-linear` / `card-bold` | |
| Share | `share-outline` / `share-bold` | |
| Edit / rename | `edit2-outline` / `edit2-bold` | note `edit2`, not `edit-2` |
| Pin / unpin | `pin-outline` / `pin-bold` | bold = pinned state |
| Delete | `trash-bin-minimalistic-outline` / `trash-bin-minimalistic-bold` | |
| Hamburger | `hamburger-menu-outline` | no bold variant |
| Activity / time | `clock-outline` / `clock-bold` | |
| Password show/hide | `eye-outline` / `eye-bold`, `eye-closed-outline` / `eye-closed-bold` | |
| Back | `arrow-left2-outline` | no bold variant |
| Filter | `filter-outline` / `filter-bold` | |
| Sort | `sort-outline` / `sort-bold` | |
| Download | `arrows-action-import-outline` / `arrows-action-import-bold` | |
| Preview | `security-eye-outline` / `security-eye-bold` | |
| Triple dot | `menu-dots-outline` (rotate-90 for vertical) | |
| Warning | `danger-triangle-outline` / `danger-triangle-bold` | |
| Enterprise / global | `global-outline` / `global-bold` | |
| Logout | `logout3-bold` / `logout3-outline` | note `logout3` |

### Variant conventions

- **Default state:** outline / linear variant.
- **Bold (filled) variants** are for *state*, not decoration:
  - active navigation item and hover (sidebar nav),
  - active toggle (`/app/chat` Chat/Search tabs),
  - hovered send button,
  - char counter at the 690 limit,
  - pinned indicators and pin/unpin actions,
  - destructive list items (logout) may use bold directly.
- Use `mxBoldName(name)` when the bold counterpart should be derived programmatically; it returns `null` for families without a bold variant.

### Gotchas

- **`strokeWidth` is not supported.** mx-icons has fixed stroke weights (1.5 for line icons). Drop `strokeWidth={1.8}`-style props when migrating.
- **`rotate-45` on pins:** mx-icons `pin-*` icons are drawn diagonally, same as lucide's — keep the existing `rotate-45` to preserve the upright look.
- **Vertical dots:** use `menu-dots-outline` with `rotate-90` where lucide used `ellipsis-vertical`.
- **Color:** icons render with `currentColor` (`stroke` for line mode, `fill` for filled mode), so `text-*` classes work. Default size is 24 — use Tailwind `size-*` classes or the `size` prop.
- **Component-ref snippets:** snippets that previously took a lucide component (`icon: FileUp`) can take `MxIconName | typeof <remaining-lucide-component>` and branch with `typeof icon === 'string'`. If every icon in the snippet is migrated, the param is just `MxIconName`.
- **Navigation configs:** arrays holding `icon: SomeLucideComponent` become `icon: MxIconName | typeof LayoutGrid` (or similar) with a conditional render; or keep components for the few unmigrated icons.
- **`data-icon="inline-start"`** (shadcn dropdown-menu convention) is passed through by `MxIcon`'s rest props — keep it when migrating dropdown items.
- **Unused imports:** after migration, remove the old lucide imports; svelte-check flags duplicates/unused references.

## Completion Timestamp

**Completed At:** 2026-08-10

## File Mapping

* **`apps/frontend/src/lib/components/icons/MxIcon.svelte`**
  * The Svelte wrapper around extracted mx-icons data. Props: `name` (`MxIconName`), `size`, `class`, rest props (index signature).
* **`apps/frontend/src/lib/components/icons/mx-icons-data.ts`**
  * Generated SVG path data (`MX_ICONS`), `MxIconName` union type, and the `mxBoldName` helper.
* **Migrated surfaces (lucide-svelte -> MxIcon):**
  * `apps/frontend/src/lib/components/chat/ChatInput.svelte`
  * `apps/frontend/src/lib/components/chat/SourceReferences.svelte`
  * `apps/frontend/src/lib/components/chat/CodeBlockPreview.svelte`
  * `apps/frontend/src/lib/components/chat/TurnStatusBadge.svelte`
  * `apps/frontend/src/lib/components/app/AppSidebar.svelte`
  * `apps/frontend/src/lib/components/app/MobileHeader.svelte`
  * `apps/frontend/src/lib/components/app/AccountPanelDialog.svelte`
  * `apps/frontend/src/lib/components/app/ShareConversationDialog.svelte`
  * `apps/frontend/src/routes/app/chat/+page.svelte`
  * `apps/frontend/src/routes/app/chat/[id]/+page.svelte`
  * `apps/frontend/src/routes/app/documents/+page.svelte`
  * `apps/frontend/src/routes/app/documents/UploadDocumentDialog.svelte`
  * `apps/frontend/src/routes/app/documents/document-card-actions.svelte`
  * `apps/frontend/src/routes/app/activity/+page.svelte`
  * `apps/frontend/src/routes/s/[code]/+page.svelte`

## Connections

* **`apps/frontend/package.json`** — `mx-icons` declared as a runtime dependency (`^1.1.1`).
* **`docs/frontend/app-chat.md`**, **`docs/frontend/app-sidebar.md`** — feature docs for the surfaces that consume `MxIcon`.
* **Remaining lucide usage** (icons without an mx-icons counterpart, e.g. `ChevronRight` pagination pairs, `Calendar`, `RotateCcw`, `Copy`, `Check`, `Loader2`, ...) stays as-is; do not force a mapping where the library has no fit.
