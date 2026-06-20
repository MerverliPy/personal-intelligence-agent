---
description: Run bounded repository quality checks (lint, format, typecheck, test) and prepare reviewable output without pushing or changing history.
agent: git-quality
subtask: true
---

Run bounded repository quality checks against the current working tree.

$ARGUMENTS

Default scope when no arguments are supplied: run format, lint, typecheck, and unit tests against changed or affected packages. Treat supplied arguments as scope priorities (e.g., a specific package, a file pattern, or a check category).

Do not commit, push, amend, rebase, or change history. Prepare reviewable output (diff summaries, check results, test counts) and finish with a concise assessment and an explicit next action.
