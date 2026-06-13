---
description: Analyze repository readiness, evidence integrity, specification consistency, and the first eligible implementation task without editing.
agent: architect
subtask: true
---

Read `AGENTS.md`, inspect repository structure and Git state when available, then read `planning/status.yaml` as a claim ledger. Identify the current phase before using targeted search to extract only relevant task blocks, direct dependencies, required reviewers, and referenced specification sections. Do not auto-include the full backlog or documentation tree.

Before declaring a task or phase complete, verify the corresponding review record: one exact `PASS` verdict, structured `PASS` evidence for every required reviewer, and, for a DONE phase or gate, one exact gate `PASS` with all structured gate-evidence lines at `PASS`. Missing, failed, unavailable, duplicate, malformed, or contradictory evidence invalidates readiness even when status says DONE.

Return:

- claimed versus verified implementation state;
- review, gate, and status-ledger contradictions;
- specification conflicts or missing decisions;
- dependency closure and first eligible task based only on verified prerequisites;
- exact evidence paths and likely affected boundaries;
- validation and approval requirements;
- risks requiring human decision;
- assumptions and unavailable checks.

Do not modify files, infer readiness from filenames, or silently trust historical status values.
