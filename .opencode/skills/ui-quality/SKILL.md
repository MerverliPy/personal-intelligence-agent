---
name: ui-quality
description: Apply PIA-specific UI quality checks to web and mobile redesign work while preserving approved repository contracts, adapter constraints, and dependency gates.
compatibility: opencode
metadata:
  audience: frontend-and-mobile-ui-agents
  governance: contract-preserving
---

## Use this skill when

A task touches `apps/web/`, `.ui-redesign/`, mobile/PWA surfaces, product-page HTML builders, shared CSS, UI states, visual hierarchy, interaction behavior, or design-contract validation.

This skill is a local quality layer. It does not authorize implementation by itself.

## Authority order

Follow this precedence, highest first:

1. `AGENTS.md` and the task-execution contract.
2. `.ui-redesign/adapter/REPOSITORY_ADAPTER.md`.
3. `.ui-redesign/decisions/DECISION_LEDGER.md`.
4. Approved `.ui-redesign/contracts/*` artifacts.
5. Existing route, API, data, and dependency boundaries.
6. This UI-quality skill.

If this skill conflicts with an approved repository artifact, the approved repository artifact wins.

## Hard boundaries

Do not:

- convert the frontend to React, Next.js, Vite, Tailwind, Motion, GSAP, shadcn/ui, or another framework;
- add third-party packages unless an approved dependency decision explicitly authorizes them;
- rewrite working server-rendered HTML builders into a new architecture;
- change routes, API contracts, persistence, schemas, infrastructure, deployment, or data behavior as a side effect of visual work;
- replace real data with mocks to make a screen look complete;
- ignore approval-gated redesign, design-contract, iPhone PWA, accessibility, or real-UI validation skills;
- treat image-generation or visual inspiration as implementation authority when a design contract exists.

## Required workflow

1. Scan the affected files and identify the current UI architecture, shared tokens, page builders, scripts, and tests.
2. Anchor every visual or behavioral decision to an approved source: design contract, decision ledger, repository adapter, existing baseline, or explicit user task.
3. Diagnose UI weaknesses before editing: typography, spacing, hierarchy, touch targets, safe areas, focus behavior, loading/error/empty states, status semantics, motion, and PWA constraints.
4. Fix surgically using the existing stack. Prefer tokenized CSS, semantic HTML, native browser behavior, and small page-builder changes.
5. Cross-check output completeness before reporting: no placeholder comments, no omitted states, no unverified claims, no invented tests.
6. Report evidence with changed files, tests/checks run, observed residual risks, and next validation step. Do not self-approve.

## PIA visual quality checklist

For every relevant UI change, check:

- typography uses the approved system stack and readable line height;
- body text does not run too wide on desktop;
- iPhone 16 Pro viewport behavior uses `100dvh` or contract-approved alternatives rather than brittle `100vh` assumptions;
- safe-area insets are preserved for header, sheet, FAB, composer, and bottom navigation surfaces;
- tap targets satisfy the approved touch minimum;
- focus-visible behavior remains visible and keyboard-accessible;
- dialogs, sheets, and modals preserve focus handling;
- network loss, loading, empty, error, disabled, streaming, interrupted, failed, and success states are represented when applicable;
- status colors remain semantic and contract-aligned;
- motion uses approved motion tokens and honors reduced-motion behavior;
- z-index values use the established scale instead of arbitrary escalation;
- visual hierarchy makes the primary task clear without decorative noise;
- copy is specific, calm, and product-accurate; no generic AI phrases, lorem ipsum, fake dashboards, or placeholder names;
- meaningful images/icons have accessible text alternatives or are correctly hidden when decorative;
- no dead links, no buttons to `#`, and no navigation dead ends.

## Anti-slop rules for PIA

Avoid these patterns unless an approved contract explicitly requires them:

- generic admin cards with border + white background + weak shadow everywhere;
- centered empty states with vague motivational copy;
- excessive pill badges or repeated status chips without hierarchy;
- purple/blue AI-gradient decoration unrelated to PIA's approved single-accent system;
- all-caps labels everywhere;
- inconsistent gray families or unapproved accent colors;
- hardcoded pixel layouts that break on iPhone safe areas;
- non-semantic `div` structures where `main`, `nav`, `section`, `article`, `form`, `dialog`, `button`, `table`, `dl`, or `output` would be more accurate;
- decorative motion that competes with reading, retrieval, citations, or approval decisions.

## Output completeness rules

Before final response, verify:

- every requested file/change was completed or explicitly blocked by an approved stop condition;
- no placeholder such as `TODO`, `implementation omitted`, `add more here`, or `left as exercise` was used as a substitute for work;
- every claim about tests, screenshots, device validation, or accessibility is backed by a real command or artifact;
- if output must be split, stop at a clean boundary and state exactly what remains.

## Stop conditions

Stop and report instead of editing when:

- the task would require a new design decision;
- the task would modify protected areas without approval;
- the approved design contract is missing, stale, or contradictory;
- dependency installation is required but not approved;
- real-data or real-device evidence is required but unavailable;
- accessibility, performance, PWA, or security evidence contradicts the intended change;
- the requested aesthetic conflicts with PIA's trust-first, evidence-grounded product posture.
