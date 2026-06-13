---
description: Summarize evidence-backed progress, contradictions, next eligible work, and gate status with bounded context.
agent: architect
subtask: true
---

Read `planning/status.yaml` first, but treat it as a claim ledger rather than completion evidence. Use targeted search in `planning/backlog.yaml` only for the current phase, final or incomplete tasks relevant to eligibility, direct dependencies, required reviewers, and the applicable gate. Read only the corresponding review records and latest exceptional run records; do not load all history or the full backlog.

For each reported final task, require an exact persisted `## Verdict: PASS` and structured `PASS` evidence for every role in `required_reviewers`. For each reported DONE gate or phase, require an exact gate `PASS`, all four structured gate-evidence lines at `PASS`, and final verified task evidence. Treat missing, failed, unavailable, duplicate, malformed, or contradictory evidence as unverified regardless of the status value.

Return a compact report with:

- claimed versus verified phase and gate completion;
- verified task states and reviewer evidence;
- blocked, failed, contradictory, stale, or concurrent work;
- next eligible task only when all dependencies are verified;
- pending approval or environment requirements;
- run-record, review, gate, and status inconsistencies;
- exact evidence paths, assumptions, and unavailable checks.

Do not modify files or propagate an unverified DONE claim into task eligibility.
