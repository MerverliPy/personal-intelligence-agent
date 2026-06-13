---
description: Perform a focused security review of a specified task, phase, diff, or subsystem.
agent: security
subtask: true
---

Require `$ARGUMENTS` to identify a concrete task, phase, diff, path, or subsystem. If the boundary is blank or materially ambiguous, stop and request one precise scope.

Read the relevant sections of `docs/05_SECURITY_GOVERNANCE.md`, applicable instructions, targeted implementation and tests, and current diff when available. Do not auto-include the full security document or unrelated source.

Review concrete attack paths, object authorization, tenant isolation, untrusted-content handling, approval boundaries, sensitive-data exposure, external effects, and remediation priority. Distinguish verified findings, reasoned risks, assumptions, and unavailable checks. Do not edit files.
