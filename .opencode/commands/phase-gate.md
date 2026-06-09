---
description: Verify that a phase satisfies every exit gate and is safe to close.
agent: qa
subtask: true
---

Evaluate phase `$1` against @planning/backlog.yaml, @planning/status.yaml, and @docs/07_TEST_EVALUATION_STRATEGY.md.

Run the required non-destructive checks. Return PASS or FAIL, missing evidence, unresolved defects, and whether the next phase may begin. Do not edit files.
