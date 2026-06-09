---
description: Produce a dependency-aware execution plan for a phase without editing files.
agent: architect
subtask: true
---

Plan phase `$1` from @planning/backlog.yaml and @planning/status.yaml.

Verify prerequisites and return:
1. eligible tasks in dependency order;
2. tasks that can run independently;
3. shared-file collision risks;
4. required environment and credentials;
5. phase-gate evidence required;
6. blockers or ambiguous specifications.

Do not implement or change status.
