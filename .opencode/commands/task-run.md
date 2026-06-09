---
description: Execute one backlog task with tests, evidence, and a run record.
agent: delivery
subtask: false
---

Execute task `$1` from @planning/backlog.yaml.

Follow @AGENTS.md and @planning/status.yaml. Load the `task-execution` skill. Verify dependencies and whether work is already complete before editing. Implement only the requested task, run all specified verification, and create `planning/runs/$1.md`.

Do not push, deploy, weaken tests, alter acceptance criteria, or mark a failed task complete.
