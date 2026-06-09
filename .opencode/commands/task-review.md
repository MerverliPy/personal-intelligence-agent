---
description: Independently review one task against its specification and evidence.
agent: reviewer
subtask: true
---

Review task `$1` using @planning/backlog.yaml, @planning/status.yaml, and `planning/runs/$1.md` if present. Inspect the relevant diff and run non-destructive verification commands.

Return a verdict and an acceptance-criterion evidence matrix. Do not edit files.
