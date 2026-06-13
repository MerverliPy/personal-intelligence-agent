---
description: Produce a dependency-aware execution plan for one exact phase without editing files.
agent: architect
subtask: true
---

Require `$1` to be one exact phase ID matching `P[0-7]`. If it is blank, malformed, missing, or ambiguous, stop without planning speculative work.

Use targeted search to extract only the requested phase, its tasks, and direct dependencies from `planning/backlog.yaml`. Read `planning/status.yaml`, applicable instructions, referenced specifications, and only the implementation evidence needed to resolve dependencies or collision risks. Do not auto-include the full backlog.

Return:

1. objective, in scope, and out of scope;
2. prerequisite and eligible tasks in dependency order;
3. tasks that can run independently;
4. shared-file and ownership collision risks;
5. required environment, credentials, and approval gates;
6. validation and phase-gate evidence;
7. blockers, assumptions, and replan conditions;
8. the next concrete action.

Do not implement or change status.
