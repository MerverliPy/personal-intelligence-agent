---
name: output-completeness
description: Prevent partial agent work by requiring complete implementation, explicit blockers, and evidence-backed reporting.
compatibility: opencode
metadata:
  audience: implementation-and-review-agents
  output: completion-check
---

## Use this skill when

A task modifies files, reports task completion, produces a run record, writes a review, or summarizes validation.

## Completion standard

A response is complete only when each requested item is either:

- implemented;
- verified as already satisfied;
- explicitly out of scope with source-backed reason;
- blocked by a named stop condition.

## Forbidden substitutes

Do not use any of these as implementation:

- placeholder TODO comments;
- omitted sections;
- fake tests;
- invented screenshots;
- invented device results;
- vague follow-up promises;
- summaries that hide incomplete files.

## Required final check

Before reporting, verify:

- changed files are listed;
- tests or checks are listed exactly as run;
- skipped checks include the reason;
- generated artifacts are named;
- residual risks are explicit;
- next validation step is concrete;
- no claim depends on unobserved evidence.

## Output

Return:

1. requested work;
2. completed work;
3. files changed;
4. checks run;
5. evidence produced;
6. blocked or deferred items;
7. residual risks;
8. next validation step.
