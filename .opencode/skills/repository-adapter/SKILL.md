---
name: repository-adapter
description: Detect and document repository-specific architecture, commands, runtime, real-data access, protected areas, Git policy, validation tools, and physical-device bridge before redesign execution.
compatibility: opencode
metadata:
  scope: repository-local
  phase: discovery
---

## Adapter requirements

Document:

- product, users, and outcomes;
- repository roots and generated paths;
- framework and architecture;
- install, start, build, lint, typecheck, unit, integration, E2E, accessibility, and performance commands;
- runtime URLs and network exposure;
- real data and authentication;
- credential boundary;
- protected areas;
- Git strategy;
- browser and device tooling;
- physical iPhone bridge;
- test matrix;
- blockers.

## Evidence rule

Mark a command as verified only after safe execution or direct existing evidence. Do not infer success from a package script name.

## Approval rule

The adapter is proposed before product changes and must be approved. Adapter approval authorizes the baseline phase, not implementation.
