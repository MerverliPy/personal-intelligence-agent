---
name: mobile-state-design
description: Ensure PIA mobile and PWA screens represent real application states clearly and accessibly.
compatibility: opencode
metadata:
  audience: mobile-ui-and-frontend-agents
  output: state-coverage-review
---

## Use this skill when

A task changes mobile or PWA UI for documents, search, conversations, citations, feedback, memory, approvals, uploads, or network behavior.

## Required states

For each relevant surface, account for:

- initial loading;
- empty data;
- successful data;
- validation error;
- server or network error;
- disabled or pending action;
- retryable failure;
- offline or reconnecting state;
- streaming or in-progress output;
- interrupted or cancelled output;
- permission or approval-required state;
- completed state.

## State design rules

- Use real product terms and state names.
- Keep copy calm and specific.
- Preserve touch targets and focus behavior.
- Do not hide failed, quarantined, interrupted, or approval-required states behind generic error copy.
- Keep citation and evidence states legible.
- Represent disabled actions visibly and programmatically.
- Avoid state colors that conflict with approved semantic tokens.

## Output

Return a state coverage matrix with surface, state, current behavior, gap, proposed fix, and validation method.
