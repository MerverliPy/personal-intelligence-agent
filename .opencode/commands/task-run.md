---
description: Execute one exact backlog task with bounded edits, progressive validation, and a persistent run record.
agent: delivery
subtask: false
---

Require `$1` to be one exact task ID matching `P[0-7]-T[0-9][0-9]`. If it is blank, malformed, missing, duplicate, or ambiguous, stop as `BLOCKED` without editing.

Use targeted search to extract only that task and direct dependencies from `planning/backlog.yaml`. Read `AGENTS.md`, applicable scoped instructions, `planning/status.yaml`, referenced specifications, and relevant implementation and tests. Do not auto-include the full backlog.

Load `task-execution`. Verify dependencies, path boundaries, repository state, required reviewers, and whether acceptance criteria already pass. Implement only the task, maintain `planning/runs/$1.md`, validate progressively, and inspect the final diff.

Do not push, deploy, commit, install dependencies, weaken tests, alter acceptance criteria, overwrite user work, or update `planning/status.yaml`. Do not apply or revert migrations against shared, persistent, staging, or production data. A task-listed migration check may run only against a verified isolated disposable test database after explicit approval of the exact command and target. Stop on any other required approval, scope expansion, unverified migration target, or unresolved safety conflict.
