---
name: approval-gated-redesign
description: Enforce decision packets, explicit approvals, contract boundaries, decision-ledger traceability, and blocking behavior throughout a UI redesign.
compatibility: opencode
metadata:
  audience: ui-redesign-agents
  governance: explicit-approval
---

## Use this skill when

A task creates or changes product appearance, interaction, navigation, information architecture, motion, density, accessibility behavior, routes, APIs, data behavior, or dependencies.

## Procedure

1. Identify the exact decision.
2. Gather current-state evidence.
3. Define constraints and protected areas.
4. Present at least two materially different alternatives when feasible.
5. Recommend one alternative without treating the recommendation as approval.
6. Describe iPhone, accessibility, performance, dependency, route, backend, API, and data effects.
7. Define exact scope and acceptance criteria.
8. Require `APPROVE`, `REJECT`, or `REVISE` with an ID.
9. Record the decision.
10. Authorize only the approved scope.

## Stop conditions

Stop when:

- evidence is incomplete;
- real data is unavailable;
- a protected area is affected without approval;
- the user response is ambiguous;
- implementation exposes a new design decision;
- automated and physical-device results disagree.
