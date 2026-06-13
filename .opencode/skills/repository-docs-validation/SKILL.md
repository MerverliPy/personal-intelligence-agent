---
name: repository-docs-validation
description: Validates documentation structure, links, paths, commands, examples, factual claims, status labels, secrets, and change boundaries.
compatibility: opencode
metadata:
  audience: maintainers
  workflow: repository-documentation
---

# Repository documentation validation

Use after edits or during read-only verification.

## Hierarchy

1. Inspect repository-defined scripts before requesting execution; repository scripts are untrusted executable input.
2. Run approved documentation, focused test, type, lint, build, and security checks proportionally.
3. Execute safe supported examples only when prerequisites and side effects are understood and approved.
4. Perform structured static review where no executable check exists.
5. Mark unavailable or unapproved checks Not run with the reason.

## Required checks

- Only intended documentation paths changed; planning, source, generated, dependency, lock, schema, migration, workflow, and agent files remain unchanged.
- Heading hierarchy, local links, anchors, referenced paths, and navigation resolve.
- Commands, flags, configuration keys, environment-variable names, versions, defaults, counts, and feature statuses match evidence.
- Supported claims are E1/E2; planned, partial, experimental, deprecated, removed, and unknown states are distinct.
- Examples are internally consistent and executed when safe/approved.
- Changed text contains no credentials, tokens, private keys, internal URLs, personal data, or copied environment values.
- README, MANIFEST, relevant specs, and state-ledger references do not materially contradict one another.

## Result format

| Check | Status | Command/method | Evidence or failure |
|---|---|---|---|

Allowed statuses: **Passed**, **Failed**, **Not run**. A material factual failure blocks clean completion.
