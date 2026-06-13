---
name: repository-docs-update
description: Applies evidence-backed documentation edits with approval gates, canonical-fact discipline, and strict implementation boundaries.
compatibility: opencode
metadata:
  audience: maintainers
  workflow: repository-documentation
---

# Repository documentation update

Use only after documentation analysis.

## Preconditions

- Targets and audiences are known.
- Material claims have E1/E2 evidence or an explicit limitation/status label.
- Pre-existing working-tree changes are identified.
- Gated actions are excluded or explicitly approved.

## Editing rules

- Preserve established terminology and voice when accurate.
- Keep README focused on purpose, verified capabilities, prerequisites, first success, configuration, and navigation.
- Keep deep architecture, product, security, API, deployment, and maintenance material in dedicated documents.
- Use one canonical location for versions, counts, defaults, compatibility, status, and commands.
- Derive phase/task progress from `planning/status.yaml`; verify review/run evidence before claiming delivery.
- Use real repository paths, commands, flags, keys, and environment-variable names.
- State prerequisites before commands and expected results for critical setup steps.
- Keep planned work out of current-feature sections.
- Update all affected cross-references when headings or paths change.
- Do not change source code, OpenAPI, schemas, migrations, planning state, agent files, workflows, generated files, or release tags.

## Approval package

Before a gated action, show the exact action and paths, evidence, reason, user-visible impact, risks, rollback/recovery implications, and safer alternative.

## Implementation handoff

When behavior appears defective, provide observed behavior, intended behavior evidence, relevant files/tests, documentation impact, investigation request, and acceptance criteria. Do not patch implementation.

## Pre-validation review

Inspect the diff, confirm only intended documentation changed, confirm no unsupported claim was introduced, and confirm status labels, canonical facts, and navigation remain coherent.
