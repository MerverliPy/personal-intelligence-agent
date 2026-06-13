---
description: Prepare and, after explicit approval, apply a bounded repair batch from an evidence-backed repository audit.
agent: repository-integrity
subtask: false
---

Require `$ARGUMENTS` to identify exact finding or task IDs from `AGENT_HANDOFF.md` or another current evidence-backed audit. If the IDs or requested repair boundary are missing or ambiguous, inspect only enough evidence to prepare an approval package and stop before mutation.

Revalidate only the cited evidence anchors, establish current repository state, preserve pre-existing work, and map the repair batch to exact files, commands, risks, recovery implications, and validation.

Do not rescan the repository broadly. Do not edit until the user explicitly approves the exact batch. Apply only the approved scope, validate progressively, inspect the final diff, and update the handoff or repair record with evidence and remaining risks.
