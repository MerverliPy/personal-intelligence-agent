---
description: Summarize verified progress, blockers, next eligible tasks, and phase-gate status.
agent: architect
subtask: true
---

Read @planning/status.yaml, @planning/backlog.yaml, and available records under `planning/runs/`.

Return a compact status report with:

- phase completion;
- verified tasks;
- blocked or failed tasks;
- stale in-progress tasks;
- next eligible task;
- pending human approvals;
- documentation or status inconsistencies.
