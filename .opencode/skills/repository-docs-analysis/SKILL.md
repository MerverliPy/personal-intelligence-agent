---
name: repository-docs-analysis
description: Maps repository evidence, classifies feature status, detects stale documentation, and identifies contradictions before documentation edits.
compatibility: opencode
metadata:
  audience: maintainers
  workflow: repository-documentation
---

# Repository documentation analysis

Use before proposing or applying documentation changes.

## Sequence

1. Identify audience, requested outcome, target documents, Git baseline, and pre-existing work.
2. Start with changed files and public surfaces; expand only when a claim depends on another component.
3. Inventory README, MANIFEST, relevant `docs/`, planning state/evidence, manifests, entry points, exported APIs, configuration, tests, examples, CI, and release metadata.
4. Extract material claims from target documents.
5. Trace each claim to runtime, tests, interfaces, configuration, implementation wiring, and reviewed planning evidence.
6. Assign E1-E5 and Supported/Experimental/Partial/Planned/Deprecated/Removed/Unknown.
7. Detect contradictions, missing onboarding, duplicate facts, stale examples, and broken navigation.
8. Assign stale confidence: High, Medium, or Low.
9. Produce a prioritized plan with exact paths, evidence, risk, and validation.

## Repository-specific rules

- `planning/status.yaml` is the state ledger; verify required run/review evidence before exposing a task as delivered.
- `planning/backlog.yaml` defines intended scope, not present behavior.
- README and MANIFEST are outputs and may lag the state ledger.
- A package, module, migration, test name, shell, or stub alone does not prove feature availability.
- Modification dates and commit recency are signals, not truth.
- Never write to `planning/**`, `.opencode/**`, implementation paths, OpenAPI, schemas, or migrations.

## Claim ledger

| Claim | Evidence paths | Rating | Status | Validation | Conflict |
| ----- | -------------- | ------ | ------ | ---------- | -------- |

## Audit output

Return scope, documentation inventory, stale findings, contradictions, missing documentation by audience, low-risk edits, approval-gated edits, evidence gaps, and suggested verification commands.
