---
trigger: always_on
description: Enforces checking the logging-best-practices folder structure reference when creating new files or folders.
---

# Folder Structure Policy

## Activation
- **Method**: Always On
- **Context**: Any implementation task where the AI needs to create new files or folders, especially when structuring new features, modules, or skills.

---

## 1. Structure Reference Mandate

Before creating any new files or folders, you **must** consult the folder structure documented in `.agents/skills/logging-best-practices/README.md`. 

Use its structure as a foundational reference for how directories, documentation, resources, and configuration should be cleanly organized within this project.

* Always maintain consistent naming conventions.
* Keep documentation alongside code/resources where applicable.
* Separate resources into logically named subdirectories.
