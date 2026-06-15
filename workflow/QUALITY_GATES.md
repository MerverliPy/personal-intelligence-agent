# Quality Gates

## Gate G0 — Repository safety

Pass when:

- Git state is recorded.
- Existing changes are identified and protected.
- branch/worktree strategy is approved.
- secrets strategy is known.
- destructive operations are excluded.

## Gate G1 — Repository adapter

Pass when the adapter specifies executable commands, runtime access, data access, protected areas, test strategy, and device bridge.

## Gate G2 — Baseline

Pass when current screens, flows, defects, performance, accessibility, feature behavior, and physical-device behavior are evidenced.

## Gate G3 — Product model

Pass when primary users, critical outcomes, information hierarchy, and prioritized screens are approved.

## Gate G4 — Concept

Pass when concepts use real data, differ materially, include interactive prototypes, describe tradeoffs, and have explicit approvals.

## Gate G5 — Design contract

Pass when design tokens, component behavior, navigation, state handling, motion, density, accessibility, safe areas, and PWA behavior are machine-readable and approved.

## Gate G6 — Implementation contract

Pass when files, phases, dependencies, backend changes, tests, rollback, Git plan, and acceptance criteria are approved.

## Gate G7 — Automated validation

Pass when:

- existing tests pass;
- required new tests pass;
- feature parity is accounted for;
- accessibility target is met;
- performance is within approved budgets;
- visual regression is reviewed;
- browser targets pass;
- no secrets appear in evidence.

## Gate G8 — Physical device

Pass when iPhone 16 Pro Safari and installed-PWA tests pass and iOS Chrome plus selected additional iPhone generations meet their assigned compatibility level.

## Gate G9 — Evidence agreement

Pass when automated and physical results agree. Any disagreement triggers root-cause review.

## Gate G10 — Delivery

Pass when the PR includes evidence, decision traceability, known limitations, dependency changes, backend evidence, rollback instructions, and final acceptance.
