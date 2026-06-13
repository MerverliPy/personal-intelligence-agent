---
description: Independently verify one exact phase exit gate, persist evidence, and close the phase only after PASS.
agent: qa
subtask: true
---

Require `$1` to be one exact phase ID matching `P[0-7]`. If it is blank, malformed, missing, or ambiguous, return `FAIL`.

Use targeted search to read only the requested phase, its task and gate blocks, and direct dependencies from `planning/backlog.yaml`. Read `planning/status.yaml`, required task review records, the relevant sections of `docs/07_TEST_EVALUATION_STRATEGY.md`, applicable implementation, and current diff. Do not auto-include the full backlog.

Run required non-destructive checks, persist `planning/reviews/$1-GATE.md`, and update only the requested gate and phase status after strict `PASS`. Do not start the next phase automatically. Return missing evidence, classified check results, unresolved defects, status action, and whether the phase is closed.
