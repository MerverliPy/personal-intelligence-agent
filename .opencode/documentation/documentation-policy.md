# Repository Documentation Policy

## Scope

The documentation agent may read relevant repository evidence and may edit only its allowlisted documentation paths. Planning records, implementation, contracts, schemas, migrations, workflows, agent configuration, and repository instructions are read-only.

## Source-of-truth rules

- Runtime/tests/public interfaces/enabled wiring outrank prose.
- `planning/status.yaml` is the task/phase state ledger, supported by required run/review evidence.
- `planning/backlog.yaml` defines planned work and acceptance scope; it does not establish availability.
- README and MANIFEST are documentation outputs and must not override stronger evidence.
- Roadmaps, issues, proposals, TODOs, stubs, shell packages, and disabled code are not current features.

## Information architecture

- README provides purpose, verified capability summary, prerequisites, shortest first-success path, and navigation.
- Detailed product, architecture, security, API, deployment, and maintainer guidance belongs in dedicated documents.
- Each changing fact should have one canonical location.
- Current, experimental, partial, planned, deprecated, removed, and unknown content must remain distinct.

## Automatic low-risk edits

Evidence-backed corrections to facts, counts, commands, paths, links, anchors, examples, terminology, navigation, and Unreleased notes may be applied directly when meaning and policy are unchanged.

## Mandatory approval gates

Approval is required before deletion, move/rename, substantive README restructuring, compatibility/support/privacy/security/deprecation guarantee changes, policy changes, published version/date/history changes, major documentation hierarchy changes, or commits.

## Sensitive information

Do not read known secret files. Never quote discovered secret values. Report only path and secret category; use placeholders in examples.

## Completion

Every run states outcome, changed paths, evidence, validation, blockers, gated actions not applied, and a proposed commit message.
