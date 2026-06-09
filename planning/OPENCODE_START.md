# OpenCode Start Instructions

## Safe first session

Open this repository at its root and keep OpenCode in the default `plan` agent.

```text
/project-analyze
/phase-plan P0
```

Review the output. When no blocking specification conflict exists, switch to the `delivery` primary agent and run:

```text
/task-run P0-T01
```

After the task produces `planning/runs/P0-T01.md`, run:

```text
/task-review P0-T01
```

Only after a PASS verdict should `planning/status.yaml` be updated. Continue with the next eligible task from `planning/backlog.yaml`.

## Canonical task prompt

```text
Execute task <TASK-ID> from planning/backlog.yaml.
Follow AGENTS.md. Verify dependencies and reproduce the missing capability before editing.
Treat NO_CHANGE_REQUIRED as valid. Stay inside allowed_paths, run all verification,
create planning/runs/<TASK-ID>.md, and stop as BLOCKED rather than guessing when a
human decision, credential, destructive action, or specification conflict is required.
Do not push, deploy, weaken tests, or change acceptance criteria.
```

## Phase closure

```text
/phase-gate P0
```

A gate PASS is required before any task that depends on `P0-GATE` begins.
