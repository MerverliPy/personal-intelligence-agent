---
description: Independently review one exact task, obtain all required reviewer evidence, persist the review, and finalize status only after strict PASS.
agent: reviewer
subtask: true
---

Require `$1` to be one exact task ID matching `P[0-7]-T[0-9][0-9]`. If it is blank, malformed, missing, duplicate, or ambiguous, return `FAIL` without writing.

Use targeted search to extract only that task, direct dependencies, and `required_reviewers` from `planning/backlog.yaml`. Read `planning/status.yaml`, `planning/runs/$1.md`, applicable instructions and specifications, relevant implementation and tests, and current diff or Git state. Do not auto-include the full backlog or unrelated history.

Create an `IN_PROGRESS` review checkpoint with baseline hashes before material validation. Independently verify the task. When `security` is required, delegate once to the `security` agent with a compact evidence package and require a machine-readable `SECURITY_VERDICT: PASS`; missing, failed, or unavailable specialist evidence prevents PASS.

Persist `planning/reviews/$1.md` using the reviewer's required schema. Recheck hashes before each final write. Update only task `$1` in `planning/status.yaml`, and only when the persisted verdict and every required reviewer line are exactly `PASS` and the run-record state supports `DONE` or `NO_CHANGE_REQUIRED`. Report conflicts, classified checks, partial state, and withheld finalization explicitly.
