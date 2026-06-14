# Decision Packet — PIA-MUR-D-003b (Concept 2: Workspace)

> **For:** orchestrator → user
> **Status:** PROPOSED (awaits user pick between this and Concept 1 / 3)
> **Phase:** concept-production (after `PIA-MUR-D-002` approval; before design-contract)
> **Parent decision:** PIA-MUR-D-002 (product model)
> **Honors:** T1=A (4-tab variant), T2=A, T3=A, T4=A (also as tab), T5=A, T6=A, T7=A

---

## Evidence (real-data, no fabrication)

Same data sources as Concept 1 (see `PIA-MUR-D-003a` decision-packet evidence table). The interactive prototype uses identical real-data fixtures and adds one new tab — the **Workspace** tab — which lists the workspaces the user has access to. The current `apps/api/src/routes/web.ts:21-130` shell **already** fetches `GET /v1/workspaces` (L92) and renders the list (L99-119); the Workspace tab is a mobile-first re-implementation of that list as a card layout.

## Problem

See `PIA-MUR-D-003a` problem statement. Workspace adds: in a multi-tenant product, the workspace boundary is the most important context signal, and pushing it to a header avatar hides it from muscle memory. The premise: a peer tab is more discoverable than a header affordance for users with ≥ 3 workspaces.

## Constraints (non-negotiable)

- T1=A accepted as a 4-tab variant (Documents / Search / Conversations / Workspace).
- All other T2–T7 = A.
- 393×852pt portrait viewport; env(safe-area-inset-*) required.
- Concepts are visual prototypes only; no product code modified.

## Materially different alternatives (the other two concepts)

- **Concept 1 — "Calm"** (PIA-MUR-D-003a): 3-tab bar; system font; hairline dividers; no custom icons; workspace is a header affordance.
- **Concept 3 — "Stream"** (PIA-MUR-D-003c): 3-tab bar; content-forward; the conversation tab is the default landing; workspace switcher is the header avatar.

Workspace differs from Calm on tab count, density, and brand distinctiveness. Workspace differs from Stream on default landing (Documents vs Conversations) and on whether workspace is a header affordance or a peer tab.

## Recommendation (do not pick — present trade-offs)

**Workspace** is the most brand-distinctive of the three concepts. It treats the workspace as a first-class surface and uses cards + PIA blue to give the product a recognizable identity. It is also the most visually complex, with the largest bundle size of the three concepts (custom SVG icons inline, custom card shadow tokens).

The user should pick Workspace if: brand distinctiveness and tab-bar density are the priority, or if they expect most users to have ≥ 3 workspaces. The user should pick Calm if: accessibility is the primary gate. The user should pick Stream if: the conversation tab is by far the most frequent entry point and the team wants the entire product to read as a "chat with citations" experience.

## Device behavior

- **Safe-area:** All interactive elements respect `env(safe-area-inset-*)` in CSS (top, bottom, left, right). The bottom tab bar uses `56pt + env(safe-area-inset-bottom, 0px)` for the bar height.
- **Dynamic Island:** Persistent content starts at ≥ 60pt from the top; the network-loss banner (T6) lives at 60pt.
- **Touch targets:** All interactive elements are ≥ 44pt; the FAB is 56pt; the Send button is 56pt; each tab is ~98pt wide on a 393pt viewport (well above 44pt).
- **Thumb reach:** Tab bar (56pt + safe area 34pt = 90pt) and FAB (right-side, 16pt from edge) and Send (right of composer) are all in the bottom 50% of the viewport.
- **Installed PWA:** Same as Calm; the in-app back chevron replaces the missing Safari back gesture; the app must survive a full-screen relaunch.

## Accessibility

- **Landmarks:** Same as Calm (`<header role="banner">`, `<nav role="navigation" aria-label="Primary">`, `<main role="main">`).
- **Rotor:** Headings descend. Cards use `tabindex="0"` and `aria-label` where appropriate.
- **Reduce motion:** All animations ≤ 280ms; reduce-motion forces them to 0.01ms.
- **Dynamic Type:** `--t-body` scales 17pt → 31pt at AX5. At AX5, cards reflow as 4-line stacks; the lists become shorter (12 rows per screen instead of 30).
- **Color contrast:** Body `#1F1B16` on `#F5F3EE` = 14.8:1 (AAA). Accent `#2563EB` on white = 4.6:1 (AA pass for body text ≥ 18pt; AA Large for < 18pt requires `#1D4ED8` = 6.1:1). **The Workspace prototype uses `--accent-pressed: #1D4ED8` for the FAB and primary buttons that contain body text** to keep contrast at AA. **UNVERIFIED in dark mode.**
- **VoiceOver:** Citation chip label is "Citation 1 of 2, claims: The retention period is 7 years, button" (same as Calm, with the visible pill number 1 instead of `[1]`).
- **External keyboard:** Tab traverses in DOM order; sheets are focus-trapped; `Esc` closes sheets.

## Performance

- **Bundle size:** The interactive prototype is larger than Calm because it inlines 4 custom SVG tab icons and uses CSS variables. The size is still small (no framework, no icon font).
- **Reflow cost:** Card elevation (`0 1pt 3pt rgba(0,0,0,0.04)`) repaints cheaply. The active-tab top accent (2pt) repaints on tab switch.
- **SSE pacing:** Same as Calm; the streamed text is appended in a single frame per delta.
- **First paint:** The system font is used; no font fetch blocks FCP.
- **Memory:** Plain DOM and inline SVG.

## Dependencies

- **None.** The concept uses only what the product already has: system font, native `<dialog>` (or `role="dialog"` for the Workspace citation sheet), plain CSS, vanilla JS, inline SVG paths. No new packages, no frameworks.
- **PWA-intent assets (manifest, service worker, apple-touch-icon, theme-color) are NOT in this concept's scope.** Tracked separately at the PWA-intent rows of the parity matrix.

## Backend, API, data, and route effects

- **Backend:** None.
- **API:** None for the in-app redesign. **However, the Workspace tab's "switch workspace" flow requires a `POST /v1/me/active-workspace` endpoint that does not exist in the current OpenAPI contract (37 operations).** This is a known gap; the design contract will flag it; the implementation contract will not implement the endpoint (it is out of redesign scope per `PIA-MUR-D-002` §7). For the prototype, tapping a non-current workspace surfaces a "Switching workspace" toast and reloads the page.
- **Schema:** None.
- **Routes:** The 6 workspace-scoped HTML routes remain; the Workspace tab is a new screen rendered at the existing `/app` shell route.
- **Data:** None. The concept uses real-data shapes from `packages/contracts/src/index.ts` and the existing fixtures in `evals/answers/datasets/*.yaml`.

## Exact scope (what this concept covers)

- 4-tab bottom bar (Documents / Search / Conversations / Workspace).
- Visual treatment of 5 screens: workspace list (new), document list, search results, conversation list, conversation detail.
- 2 bottom sheets: citation (blue accent), mode-of-conversation.
- Tab bar, composer (text + iOS dictation as system affordance), blue FAB, network banner, status badges, filled-blue citation chips, search result cards, workspace cards.
- 7 SVG screenshots (6 screens + 1 offline state).
- Interactive prototype (HTML/CSS/JS).
- Annotated source-file change list for the design-contract phase.
- Default-landing question (Documents proposed) — see `evidence/default-landing.md`.

## What this concept does NOT cover (deferred to other phases)

- The actual implementation in `apps/web/src/pages/`. Concepts are visual prototypes only.
- The PWA-intent assets (manifest, service worker, theme-color, apple-touch-icon, startup image).
- The `apple-mobile-web-app-capable` meta.
- The `POST /v1/me/active-workspace` endpoint for switching workspaces.
- The destructive-confirm bottom sheet for `document-detail.ts:159` (replaces `window.confirm()`).
- The output of the FE parse step in `search.ts:131` (`JSON.stringify(locator)`).

## Acceptance criteria (for this concept to be selected)

- **AC1.** Renders correctly at 393×852pt portrait (no horizontal scroll, no clipped content).
- **AC2.** Bottom tab bar shows exactly 4 tabs (Documents / Search / Conversations / Workspace); the active tab is `aria-current="page"`.
- **AC3.** Tapping the Workspace tab shows a card list of all workspaces the user has access to; the current workspace is marked with a blue ring + ✓ glyph.
- **AC4.** The bottom-sheet citation modal (T2=A) renders source, locator (as `page N`, not `JSON.stringify`), verification status, and the claim. The "Open source" button uses `--accent` for the primary action.
- **AC5.** The network banner (T6=A) appears when the dev "Offline" toggle is on, and disables the FAB and Send button.
- **AC6.** The FAB (T7=A) appears on Documents and Conversations tabs; the Documents FAB opens the upload sheet and the Conversations FAB opens the mode-selector sheet. The FAB uses `--accent` background with a 56pt circle and a 4pt-blur drop shadow.
- **AC7.** The composer (T5=A) is text-only; there is no mic button. The iOS keyboard dictation affordance is the only dictation entry point.
- **AC8.** `prefers-color-scheme: dark`, `prefers-reduced-motion: reduce`, and AX5 (Larger Text) all switch the prototype's appearance with no layout breakage. The accent darkens to `--accent: #3B82F6` in dark mode; the body text inverts to `#F5F3EE`.
- **AC9.** The 4 tab icons are inline SVG paths (document-with-text, magnifier, chat-bubble, stacked-layers). No third-party icon font.
- **AC10.** No invented data: every label, status, mode, workspace, and citation comes from `apps/web/src/pages/*`, `packages/contracts/src/index.ts`, or `evals/answers/datasets/sample.yaml`.
- **AC11.** The user has picked a default-landing tab (Documents proposed; Conversations and Workspace are alternatives).

## Response syntax

The orchestrator should accept this packet by recording the decision in `.ui-redesign/decisions/DECISION_LEDGER.md` as `PIA-MUR-D-003b` with the user's pick (RECOMMENDED, ACCEPTED, REJECTED, or REVISED) and a one-line rationale. The user MUST also pick a default-landing tab. On `ACCEPTED`, the next phase is `design-contract`. On `REJECTED`, the user picks from `PIA-MUR-D-003a` (Calm) or `PIA-MUR-D-003c` (Stream). On `REVISED`, the orchestrator returns the user-supplied revisions and the visual-concept-prototyper regenerates this concept to address them.

---

**UNVERIFIED items (mirrored from `PIA-MUR-D-002` §10):**

- iOS 16 Pro Safari focus-management behavior of native `<dialog>` `showModal()`.
- `prefers-reduced-motion` media-query support in iOS 16 Pro installed PWA mode.
- Color-contrast ratios of badge classes in dark mode (estimates; needs automated axe-core check).
- The new `POST /v1/me/active-workspace` endpoint for switching workspaces (out of redesign scope; flagged for the design contract).
- Physical iPhone 16 Pro availability and reachability (B-1; blocks `device-validation` only).
