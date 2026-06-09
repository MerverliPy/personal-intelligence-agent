---
description: Analyze repository readiness, specification consistency, and the first eligible implementation task.
agent: architect
subtask: true
---

Analyze the repository using @AGENTS.md, @planning/status.yaml, @planning/backlog.yaml, and the authoritative documents in @docs/.

Return:
- current implementation state;
- specification conflicts or missing decisions;
- dependency graph concerns;
- first eligible task;
- exact files that task should read and likely modify;
- risks that require human decision before execution.

Do not modify files.
