---
description: Independently verify one exact phase exit gate, persist structured evidence, and close the phase only after strict PASS.
agent: qa
subtask: true
---

Require `$1` to be one exact phase ID matching `P[0-7]`. If it is blank, malformed, missing, duplicate, or ambiguous, return `FAIL` without writing.

Use targeted search to read only the requested phase, its tasks, gate, direct dependencies, and each task's `required_reviewers` from `planning/backlog.yaml`. Read `planning/status.yaml`, every required task review for that phase, relevant sections of `docs/07_TEST_EVALUATION_STRATEGY.md`, applicable implementation evidence, and current diff or Git state. Do not auto-include the full backlog or unrelated review history.

Create an `IN_PROGRESS` gate checkpoint with baseline hashes. Require every phase task to have a final status, an exact persisted task verdict of `PASS`, and structured `PASS` evidence for every required reviewer. Run proportional non-destructive gate checks and persist `planning/reviews/$1-GATE.md` using the QA schema.

Recheck hashes before each final write. Update only gate `$1-GATE` and phase `$1`, and only when the persisted gate verdict and every required gate-evidence line are exactly `PASS`. Do not start the next phase. Return contradictions, classified checks, partial state, status action, and whether the phase is closed.
