---
name: design-contract-lint
description: Review PIA design contracts for completeness, internal consistency, and implementation readiness before product changes begin.
compatibility: opencode
metadata:
  audience: design-system-and-validation-agents
  output: contract-lint-report
---

## Use this skill when

A task writes, reviews, or updates `.ui-redesign/contracts/*` artifacts.

## Lint checklist

Validate that the contract includes:

- target devices and environments;
- semantic tokens;
- typography, spacing, shape, elevation, and motion rules;
- reduced-motion behavior;
- safe-area and dynamic-viewport behavior;
- component anatomy;
- loading, empty, error, disabled, offline, and success states;
- accessibility requirements;
- PWA behavior;
- data policy;
- decision references;
- validation plan;
- rollback notes.

## Consistency checks

Flag:

- Markdown and JSON contract disagreement;
- unresolved choices hidden as prose;
- token names used without definitions;
- components without states;
- states without validation;
- references to unavailable files;
- visual decisions not tied to approved decisions;
- dependency or route implications without approval path.

## Output

Return:

1. contract paths inspected;
2. pass/fail summary;
3. blocking issues;
4. non-blocking issues;
5. required decision packets;
6. implementation readiness verdict.
