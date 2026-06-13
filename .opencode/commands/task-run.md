---
description: Execute one exact backlog task with bounded edits, progressive validation, and a persistent run record.
agent: delivery
subtask: false
---

Require `$1` to be one exact task ID matching `P[0-7]-T[0-9][0-9]`. If it is blank, malformed, missing, or ambiguous, stop as `BLOCKED` without editing.

Use targeted search to extract only that task's block from `planning/backlog.yaml`. Read `AGENTS.md`, applicable scoped instructions, `planning/status.yaml`, the task's referenced specifications, and relevant implementation and tests. Do not auto-include the full backlog.

Load `task-execution`. Verify dependencies, path boundaries, current repository state, and whether acceptance criteria already pass before editing. Implement only the task, create or update `planning/runs/$1.md`, validate progressively, and inspect the final diff.

Do not push, deploy, commit, install dependencies, run migrations, weaken tests, alter acceptance criteria, overwrite user work, or update `planning/status.yaml`. Stop on any required approval, scope expansion, or unresolved safety conflict.
