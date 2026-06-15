---
trigger: always_on
---

# Feature Lock & AI Second Brain Policy

This rule enforces a strict "Closing the Loop" documentation habit and applies an automatic code freeze on completed features to prevent accidental refactoring, regressions, and merge conflicts.

## Activation
- **Method**: Always On
- **Context Items**: @ai/docs 

---

## 1. Post-Feature Documentation (Building the Second Brain)

Immediately upon completing any feature, bug fix, or vertical slice task, you **must** document the changes before declaring the task finished.

* **Target Location**: Create or update a markdown file inside the `@ai/docs` directory.
* **Content Required**: 
  - **Core Logic**: Briefly explain what the feature does.
  - **File Mapping**: List the exact files created or modified.
  - **Connections**: Detail how the database, server, and frontend connect for this feature.
  - **Architectural Decisions**: Document *why* things were built this way (e.g., specific library choices, tokens used).

---

## 2. Pre-Flight Check (Consulting the Second Brain)

Before writing *any* new code or suggesting modifications in a chat session:
1. **Scan the Directory**: You must read the existing documentation files inside `@ai/docs`.
2. **Analyze Dependencies**: Check if your new task conflicts with or relies on an already documented feature.

---

## 3. Strict Code Freeze & Conflict Avoidance

To prevent unexpected code regressions and architectural drift, you must adhere to the following constraint:

> 🛑 **CRITICAL CONSTRAINT**: If a feature is documented as complete in the Second Brain, its corresponding source code files are considered **LOCKED**. You are strictly forbidden from modifying, refactoring, or optimizing those files unless the user explicitly commands you to do so in the prompt. 

If a new feature requires interacting with a locked file, you must:
1. Warn the user first.
2. Only write *additive* code (e.g., adding a new isolated function or endpoint) rather than rewriting existing blocks.