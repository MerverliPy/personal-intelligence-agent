---
description: Summarize verified progress, blockers, next eligible work, and gate status with bounded context.
agent: architect
subtask: true
---

Read `planning/status.yaml` first. Use targeted search in `planning/backlog.yaml` only for the current phase, incomplete tasks, direct dependencies, and applicable gate. Inspect only the latest or exceptional records under `planning/runs/` and `planning/reviews/`; do not load all historical records or the full backlog.

Return a compact report with:

- phase and gate completion;
- verified task states and review evidence;
- blocked, failed, contradictory, or stale work;
- next eligible task and dependencies;
- pending approval or environment requirements;
- documentation, run-record, review, or status inconsistencies;
- assumptions and unavailable evidence.

Do not modify files.
