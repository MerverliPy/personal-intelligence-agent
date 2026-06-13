---
description: Analyze repository readiness, specification consistency, and the first eligible implementation task without editing.
agent: architect
subtask: true
---

Read `AGENTS.md`, inspect repository structure and Git state when available, then read `planning/status.yaml`. Identify the current phase before using targeted search to extract only relevant task blocks from `planning/backlog.yaml` and only their referenced specification sections. Do not auto-include the full backlog or documentation tree.

Return:

- verified current implementation state;
- specification conflicts or missing decisions;
- dependency and status-ledger concerns;
- first eligible task;
- exact evidence paths and likely affected boundaries;
- validation and approval requirements;
- risks requiring human decision;
- assumptions and unavailable checks.

Do not modify files or infer readiness from filenames alone.
