---
trigger: model_decision
description: Enforces the UI component strategy for the SvelteKit frontend, prioritizing shadcn-svelte base components before writing custom implementations.
---

# Frontend Component Strategy

## Activation

* **Method**: Model Decision
* **Files**: `apps/frontend/**/*.svelte`, `apps/frontend/src/lib/components/**/*`

---

## 1. Component Creation Strategy

When creating or modifying a UI component, you **MUST** follow this strict priority order:

1. **Prioritize shadcn-svelte**: Always check `ai/learn/shadcn-svelte.md` first to see if a suitable base component exists in the registry.
2. **Override Styles**: Use custom Tailwind classes (via the `class` prop) or raw CSS to override the base shadcn-svelte component styling to match the required design.
3. **Build from Scratch (Only if necessary)**: Only build a component completely from scratch if the required UI is too complex or unique to be handled by overriding a shadcn-svelte primitive.

Do not write standard structural UI elements (like Dialogs, Dropdowns, Selects, Buttons, Accordions, etc.) from scratch without verifying that shadcn-svelte does not have a suitable starting point.
