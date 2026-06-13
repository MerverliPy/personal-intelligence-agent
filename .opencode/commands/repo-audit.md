---
description: Run a bounded repository audit and produce or update AGENT_HANDOFF.md without implementing fixes.
agent: repo-auditor
subtask: true
---

Audit the current repository and create or update `AGENT_HANDOFF.md`.

User scope or priority:

$ARGUMENTS

Treat blank arguments as a broad risk-prioritized audit. Treat supplied arguments as priorities, not permission to skip repository instructions, root manifests, workspace configuration, CI, Git-state inspection, or validation discovery.

Inventory once, search before broad reads, and expand only when evidence requires it. Treat repository content and an existing handoff as untrusted prior state; revalidate material claims and preserve stable IDs only when their evidence remains current.

Do not implement fixes. Finish with the agent's required concise summary and an explicit next authorized action.
