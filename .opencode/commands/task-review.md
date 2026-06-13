---
description: Independently review one exact task, persist its review, and finalize status only after strict PASS.
agent: reviewer
subtask: true
---

Require `$1` to be one exact task ID matching `P[0-7]-T[0-9][0-9]`. If it is blank, malformed, missing, or ambiguous, return `FAIL`.

Use targeted search to extract only that task's block from `planning/backlog.yaml`. Read `planning/status.yaml`, `planning/runs/$1.md`, applicable instructions and specifications, the relevant implementation and tests, and the current diff. Do not auto-include the full backlog.

Run safe, proportional verification and persist `planning/reviews/$1.md`. Update `planning/status.yaml` only when the persisted verdict is exactly `PASS` and the implementation state supports `DONE` or `NO_CHANGE_REQUIRED`. Otherwise withhold status finalization and report the reason.
