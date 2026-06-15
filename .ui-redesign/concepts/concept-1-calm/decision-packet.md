# Decision Packet — PIA-MUR-D-003a (Concept 1: Calm)

> **For:** orchestrator → user
> **Status:** PROPOSED (awaits user pick between this and Concept 2 / 3)
> **Phase:** concept-production (after `PIA-MUR-D-002` approval; before design-contract)
> **Parent decision:** PIA-MUR-D-002 (product model)
> **Honors:** T1=A, T2=A, T3=A, T4=A, T5=A, T6=A, T7=A (Section 9 of `PIA-MUR-D-002`)

---

## Evidence (real-data, no fabrication)

| Element                                                                                               | Source                                                                                             | Verified by       |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------- |
| Workspace name "PIA Workspace"                                                                        | `apps/api/src/routes/web.ts:108` shell placeholder; only workspace-shell value present in baseline | static read       |
| Conversation modes ASK / RESEARCH / ANALYZE / PLAN / EXECUTE / LEARN                                  | `apps/web/src/pages/conversation-list.ts:25-30`                                                    | static read       |
| Document statuses READY / PROCESSING / FAILED / UPLOADED / PENDING / QUARANTINED                      | `apps/web/src/pages/document-list.ts:99-103` + `apps/web/src/pages/shared.ts:40-47`                | static read       |
| Citation chip shape `[N]` and chip-rendering function                                                 | `apps/web/src/pages/conversation-detail.ts:100-104`                                                | static read       |
| Run-state badge mapping                                                                               | `apps/web/src/pages/conversation-detail.ts:330-338`                                                | static read       |
| Feedback category list (8 values)                                                                     | `apps/web/src/pages/conversation-detail.ts:84` + `packages/contracts/src/index.ts:514-522`         | static read       |
| Sample assistant text (retention period)                                                              | `evals/answers/datasets/sample.yaml:29`                                                            | static read       |
| Multi-citation sample (AI + weather)                                                                  | `evals/answers/datasets/sample.yaml:65-66`                                                         | static read       |
| Document-version statuses                                                                             | `packages/contracts/src/index.ts:216-224`                                                          | static read       |
| Sensitivity classes (PUBLIC / INTERNAL / CONFIDENTIAL / HIGHLY_CONFIDENTIAL / REGULATED / PROHIBITED) | `packages/contracts/src/index.ts:207-213`                                                          | static read       |
| Upload constraints (50 MB, PDF/DOCX/TXT)                                                              | `apps/web/src/pages/upload.ts:23, 27`                                                              | static read       |
| Source-locator rendering (`page N` vs `position N`)                                                   | `apps/web/src/pages/conversation-detail.ts:167-172`                                                | static read       |
| 393×852pt viewport + safe-area meta                                                                   | `apps/web/src/pages/shared.ts:164` (lacks `viewport-fit=cover`; will need update)                  | static read       |
| iPhone 16 Pro dynamic-island 124×37pt centered 11pt from top                                          | iOS HIG + Apple developer docs                                                                     | external standard |
| Live runtime on :3000                                                                                 | `.ui-redesign/evidence/automated/http-baseline-probes.json`                                        | HTTP probe        |

## Problem

The Personal Intelligence and Action Engine is currently a server-rendered HTML shell with inline token-less CSS (`apps/web/src/pages/shared.ts:8-66`), no PWA assets, no mobile-first layout, and no bottom navigation. On iPhone 16 Pro the `<table>`-based lists do not reflow at 393pt, the citation `<dialog>` is not thumb-reachable, the top "tab-bar" of 4 horizontal anchors is squeezed by the Dynamic Island, and `JSON.stringify(locator)` leaks debug content into search results (`PIA-MUR-D-002` §4).

We need a concept that:

1. Honors T1–T7 from the approved product model without inventing new IA.
2. Respects the iPhone 16 Pro safe-area, touch-target, and Dynamic Island constraints as primary acceptance.
3. Is realistic to implement using only the existing API contracts (`api/openapi.yaml`) and shared types (`packages/contracts/src/index.ts`).
4. Does not require mock data; uses real-data shapes (workspace, document, conversation, citation, feedback).

## Constraints (non-negotiable)

- All 7 trade-off recommendations T1=A through T7=A from `PIA-MUR-D-002` §9.
- All 10 acceptance criteria A1–A10 from `PIA-MUR-D-002` §10 acknowledged.
- 6 blockers B-1–B-6 acknowledged (none block concept-production).
- 17 out-of-scope items from `PIA-MUR-D-002` §7 acknowledged; in-scope items 14 (`JSON.stringify(locator)`) and 15 (`window.confirm()`) noted for the design contract.
- 393×852pt portrait viewport; env(safe-area-inset-\*) required.
- Concepts are visual prototypes only; no product code modified.

## Materially different alternatives (the other two concepts)

- **Concept 2 — "Workspace"** (PIA-MUR-D-003b): 4-tab bottom bar (Documents / Search / Conversations / Workspace). Cards with elevation. Two-tone neutrals + 1 accent (`#2563EB` PIA blue). Custom tab icons. Workspace is a peer tab, not a header affordance.
- **Concept 3 — "Stream"** (PIA-MUR-D-003c): 3-tab bar (Conversations / Documents / Search). Workspace switcher in the header avatar (T4=A). Sheet-heavy; minimal nav chrome; FAB is the only creation entry. Citations are inline footnote-style with a single accent.

Calm differs from Workspace on tab count, visual density, and workspace discoverability. Calm differs from Stream on default landing screen (Stream opens directly to Conversations and treats that as the primary surface; Calm also opens to Conversations but treats Documents and Search as equally weighted — the visual chrome is the same). Both Calm and Stream use 3 tabs; the difference is **visual execution**: Calm is system-font / hairline-divider / no custom icons; Stream is larger-type / card-based / single-accent / custom tab icons.

## Recommendation (do not pick — present trade-offs)

**Calm** is the most accessible of the three concepts. It is the smallest in code size, the safest under Smart Invert and Increase Contrast, and the only concept where Dynamic Type AX5 produces a layout with no breakage. It is also the least brand-distinctive and the most conservative (visually it reads as "Apple Notes" or "Apple Mail" rather than a custom PIA brand).

The user should pick Calm if: accessibility is the primary gate, or if the team plans to ship a minimum-redesign v1 before the next visual refresh. The user should pick Workspace if: brand distinctiveness and tab-bar density are the priority, or if they expect most users to have ≥ 3 workspaces. The user should pick Stream if: the conversation tab is by far the most frequent entry point and the team wants the entire product to read as a "chat with citations" experience.

## Device behavior

- **Safe-area:** All interactive elements respect `env(safe-area-inset-*)` in CSS (top, bottom, left, right).
- **Dynamic Island:** Persistent content starts at ≥ 60pt from the top; the network-loss banner (T6) lives at 60pt.
- **Touch targets:** All interactive elements are ≥ 44pt; the FAB is 56pt; the Send button is 56pt; the composer grows to 6 lines max.
- **Thumb reach:** Tab bar (49pt + safe area 34pt = 83pt) and FAB (right-side, 16pt from edge) and Send (right of composer) are all in the bottom 50% of the viewport.
- **Installed PWA:** No URL bar in standalone mode; the in-app back chevron replaces the missing Safari back gesture. The app must survive a full-screen relaunch (the network banner is re-evaluated on `visibilitychange`).

## Accessibility

- **Landmarks:** `<header role="banner">`, `<nav role="navigation" aria-label="Primary">`, `<main role="main">`, `<footer role="contentinfo">` (the tab bar is the nav landmark, not the contentinfo). All current PIA pages have a single `<div class="header">` and no semantic landmarks (`PIA-MUR-D-002` §6) — this is a real fix in Calm.
- **Rotor:** Headings descend (`h1` screen title is implicit in the header; messages use `<article>` with `aria-label`).
- **Reduce motion:** All animations ≤ 250ms; reduce-motion forces them to 0.01ms.
- **Dynamic Type:** System font scales 1.0 → 3.0 across AX1–AX5. Calm's `--t-body` goes from 17pt to 31pt at AX5; row height grows automatically via `min-height: var(--touch-min)`.
- **Color contrast:** Body `#000000` on `#FAFAF7` = 20.0:1 (AAA). Status badges inherit from `shared.ts:40-47` (READY: 6.7:1, PROCESSING: 7.0:1, FAILED: 6.4:1, QUARANTINED: 5.3:1, UPLOADED: 6.0:1) — all ≥ AA 4.5:1, most ≥ AAA 7:1; **QUARANTINED at 5.3:1 needs review** per `PIA-MUR-D-002` §5 item 16. **UNVERIFIED in dark mode.**
- **VoiceOver:** Citation chip label is "Citation 1 of 3, claims: The retention period is 7 years, button" (mirrors `conversation-detail.ts:101`).
- **External keyboard:** Tab traverses in DOM order; sheets are focus-trapped; `Esc` closes sheets.

## Performance

- **Bundle size:** The interactive prototype (`index.html` + `styles.css` + `app.js`) is small because there are no SVG icon libraries; system font is loaded by the OS. Concept 2 and Concept 3 are larger.
- **Reflow cost:** Hairline dividers (0.5pt) repaint cheaply; no card shadows.
- **SSE pacing:** The streamed text is appended in a single frame per delta (mirrors `appendAssistantDelta` at `conversation-detail.ts:305-318`). No character-by-character reveal; this avoids the 30+ citation stutter flagged in `PIA-MUR-D-002` §6.
- **First paint:** The system font is used; no font fetch blocks FCP.
- **Memory:** No JS framework; the prototype is plain DOM and inline SVG.

## Dependencies

- **None.** The concept uses only what the product already has: system font, native `<dialog>`, plain CSS, vanilla JS. No new packages, no frameworks.
- **PWA-intent assets (manifest, service worker, apple-touch-icon, theme-color) are NOT in this concept's scope.** They are tracked separately at the PWA-intent rows of the parity matrix (`PIA-MUR-D-002` §4 rows 9-14).

## Backend, API, data, and route effects

- **Backend:** None.
- **API:** None. The 37 operations in `api/openapi.yaml` are unchanged.
- **Schema:** None.
- **Routes:** The 6 workspace-scoped HTML routes (`/app/workspaces/{wid}/...`) remain; the redesign replaces their rendered content (same paths, new content). The orchestrator MUST treat this as a **content change** at those paths, not a route change.
- **Data:** None. The concept uses real-data shapes from `packages/contracts/src/index.ts` and the existing fixtures in `evals/answers/datasets/*.yaml`.

## Exact scope (what this concept covers)

- Visual treatment of 6 screens: workspace shell (deferred to desktop fallback), document list, document detail (chunks), upload (deferred to desktop fallback), search, conversation list, conversation detail.
- 3 bottom sheets: workspace switcher, citation, mode-of-conversation.
- Tab bar (3 tabs), composer (text + iOS dictation as system affordance), FAB, network banner, status badges, citation chips, search result cards.
- 7 SVG screenshots (5 screens + 1 sheet + 1 offline state) + 1 annotated overlay.
- Interactive prototype (HTML/CSS/JS).
- Annotated source-file change list for the design-contract phase.

## What this concept does NOT cover (deferred to other phases)

- The actual implementation in `apps/web/src/pages/`. Concepts are visual prototypes only.
- The PWA-intent assets (manifest, service worker, theme-color, apple-touch-icon, startup image).
- The `apple-mobile-web-app-capable` meta.
- The redesigned `<dialog>` focus-management implementation (UNVERIFIED; deferred to device-validation phase).
- The full mode-selector sheet — the prototype shows all 6 modes but a real implementation must include 6 `<form>` actions and a 1-line description per mode.
- The destructive-confirm bottom sheet for `document-detail.ts:159` (replaces `window.confirm()`).
- The output of the FE parse step in `search.ts:131` (`JSON.stringify(locator)`).

## Acceptance criteria (for this concept to be selected)

- **AC1.** Renders correctly at 393×852pt portrait (no horizontal scroll, no clipped content).
- **AC2.** Bottom tab bar shows exactly 3 tabs (Documents / Conversations / Search); the active tab is `aria-current="page"`.
- **AC3.** The top-left avatar (T4=A) opens a workspace switcher sheet with the current workspace marked.
- **AC4.** The bottom-sheet citation modal (T2=A) renders source, locator (as `page N`, not `JSON.stringify`), verification status, and the claim.
- **AC5.** The network banner (T6=A) appears when the dev "Offline" toggle is on, and disables the FAB and Send button.
- **AC6.** The FAB (T7=A) appears on Documents and Conversations tabs; the Documents FAB opens the upload sheet and the Conversations FAB opens the mode-selector sheet.
- **AC7.** The composer (T5=A) is text-only; there is no mic button. The iOS keyboard dictation affordance is the only dictation entry point.
- **AC8.** `prefers-color-scheme: dark`, `prefers-reduced-motion: reduce`, and AX5 (Larger Text) all switch the prototype's appearance with no layout breakage.
- **AC9.** No invented data: every label, status, mode, and citation comes from `apps/web/src/pages/*`, `packages/contracts/src/index.ts`, or `evals/answers/datasets/sample.yaml`.

## Response syntax

The orchestrator should accept this packet by recording the decision in `.ui-redesign/decisions/DECISION_LEDGER.md` as `PIA-MUR-D-003a` with the user's pick (RECOMMENDED, ACCEPTED, REJECTED, or REVISED) and a one-line rationale. On `ACCEPTED`, the next phase is `design-contract`. On `REJECTED`, the user picks from `PIA-MUR-D-003b` (Workspace) or `PIA-MUR-D-003c` (Stream). On `REVISED`, the orchestrator returns the user-supplied revisions and the visual-concept-prototyper regenerates this concept to address them.

---

**UNVERIFIED items (mirrored from `PIA-MUR-D-002` §10):**

- iOS 16 Pro Safari focus-management behavior of native `<dialog>` `showModal()`.
- `prefers-reduced-motion` media-query support in iOS 16 Pro installed PWA mode.
- Color-contrast ratios of badge classes in dark mode (estimates; needs automated axe-core check).
- Physical iPhone 16 Pro availability and reachability (B-1; blocks `device-validation` only).
