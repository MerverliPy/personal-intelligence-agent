---
name: task-execution
description: Execute a single machine-readable backlog task safely with dependency checks, bounded edits, verification evidence, and a standardized run record.
compatibility: opencode
metadata:
  project: personal-intelligence-action-engine
  workflow: implementation
---

## Procedure

1. Locate the task ID in `planning/backlog.yaml`.
2. Confirm every `depends_on` task is `DONE` or `NO_CHANGE_REQUIRED` in `planning/status.yaml`.
3. Read the task's `spec_refs`, inputs, and relevant code.
4. Check whether acceptance criteria already pass. Use `NO_CHANGE_REQUIRED` when justified.
5. State the intended change set and verification commands.
6. Implement only within the task boundary.
7. Run focused tests, typecheck, lint, integration tests, and any task-specific checks.
8. Create `planning/runs/<TASK-ID>.md` with evidence.
9. End with exactly one state: DONE, NO_CHANGE_REQUIRED, BLOCKED, or FAILED_VERIFICATION.

## Stop conditions

Stop as `BLOCKED` when:

- a dependency is incomplete;
- a specification conflict changes externally visible behavior;
- a credential or external account is required;
- a destructive migration or production action is required;
- security cannot be preserved with the available design.
