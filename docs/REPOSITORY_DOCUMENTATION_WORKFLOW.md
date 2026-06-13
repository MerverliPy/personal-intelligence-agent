# Repository Documentation Workflow

The repository includes an evidence-driven OpenCode documentation maintainer that can run directly or as a delegated specialist.

## Components

- Agent: `.opencode/agents/repository-docs.md`
- Commands: `.opencode/commands/docs-*.md`
- Skills: `.opencode/skills/repository-docs-*/SKILL.md`
- Repository profile and policy: `.opencode/documentation/`
- Regression suite: `.opencode/benchmarks/repository-docs/`

## Commands

| Command                    | Purpose                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `/docs-audit [scope]`      | Read-only evidence-backed audit.                             |
| `/docs-update [objective]` | Audit, apply low-risk documentation edits, validate, report. |
| `/docs-changed [base]`     | Diff-aware documentation maintenance.                        |
| `/docs-verify [scope]`     | Read-only factual/structural verification.                   |
| `/docs-release [scope]`    | Maintain Unreleased changelog or draft notes.                |

The agent can also be invoked with `@repository-docs`.

## Recommended first run

```text
/docs-audit complete repository documentation; prioritize README and MANIFEST delivery-state accuracy, verified capabilities, installation, configuration, examples, support paths, and contradictions with current implementation and reviewed planning evidence
```

After reviewing the audit:

```text
/docs-update apply all low-risk evidence-backed corrections from the audit; preserve approval-gated actions as proposals
```

## Safety model

Routine factual, link, path, command, example, terminology, and navigation corrections may be applied directly. Deletion, move/rename, major README restructuring, policy or compatibility changes, published release-history changes, major information-architecture changes, and commits require explicit approval.

The agent cannot edit implementation, planning state, OpenAPI, schemas, migrations, existing agent/workflow configuration, repository instructions, or Git metadata. It never pushes.

## Currentness rules

- Runtime, tests, public interfaces, active configuration, and enabled wiring are the strongest evidence.
- `planning/status.yaml` is the delivery-state ledger, but public delivery claims require the repository's required review/run evidence.
- `planning/backlog.yaml` describes planned scope, not current availability.
- README and MANIFEST are documentation outputs and may lag repository state.
- Recalculate phase/task counts on every relevant update; do not copy old totals.

## Validation

Repository scripts are treated as untrusted executable input. The agent inspects their command chain and requests explicit approval before execution. Every check is reported as Passed, Failed, or Not run.

Run the regression suite under `.opencode/benchmarks/repository-docs/` after changing the agent, skills, commands, permissions, policy, model, or validation profile.
