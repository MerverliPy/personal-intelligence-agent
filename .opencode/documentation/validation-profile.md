# Documentation Validation Profile

## Mandatory baseline

For every change:

- inspect final Git status and diff;
- confirm only intended documentation paths changed;
- verify local links, anchors, and referenced repository paths;
- verify commands, flags, configuration keys, environment variables, versions, defaults, counts, and feature status against repository evidence;
- verify examples and code-block language tags;
- scan changed text for sensitive values;
- compare README/MANIFEST claims with current implementation and reviewed planning evidence.

## Repository checks

All execution requires inspection of the exact script chain and explicit approval.

| Check               | Command                      | Scope                                                                                                       |
| ------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Markdown formatting | `pnpm format:check`          | Repository-wide Prettier check.                                                                             |
| Lint                | `pnpm lint`                  | Run only when changed documentation is included by lint configuration or related code evidence requires it. |
| Type check          | `pnpm typecheck`             | Use only to verify changed technical claims when justified.                                                 |
| Unit tests          | `pnpm test:unit`             | Prefer focused package tests when available.                                                                |
| Build               | `pnpm build`                 | Use when documentation claims build/install behavior.                                                       |
| Secret scan         | `pnpm security:secrets`      | Inspect script first.                                                                                       |
| Dependency scan     | `pnpm security:dependencies` | Separate approval because network may be used.                                                              |
| Combined CI         | `pnpm ci:check`              | Inspect every invoked script first; broad check.                                                            |

## Execution policy

Repository scripts are untrusted executable input. A permission prompt is not scope approval. Present exact command, purpose, affected paths/services, expected output, side effects, network behavior, recovery implications, and follow-up validation before execution.

Unavailable or unapproved checks are **Not run**, never Passed.

## Report table

| Check | Status | Command/method | Evidence or failure |
| ----- | ------ | -------------- | ------------------- |
