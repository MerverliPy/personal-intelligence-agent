# Decision Packet — PIA-MUR-D-003c (Concept 3: Stream)

> **For:** orchestrator → user
> **Status:** PROPOSED (awaits user pick between this and Concept 1 / 2)
> **Phase:** concept-production (after `PIA-MUR-D-002` approval; before design-contract)
> **Parent decision:** PIA-MUR-D-002 (product model)
> **Honors:** T1=A (3 tabs, Conversations default), T2=A, T3=A, T4=A, T5=A, T6=A, T7=A

---

## Evidence (real-data, no fabrication)

Same data sources as Concepts 1 and 2 (see `PIA-MUR-D-003a` evidence table). The Stream interactive prototype uses identical real-data fixtures; the visual treatment is what changes. Citations in `interactive/index.html` mirror the existing `renderCitationChipClient` shape (`apps/web/src/pages/conversation-detail.ts:100-104`) — Stream is the **lowest-risk concept** to implement for the citation chip because it preserves the existing `[N]` shape.

| Element                                                                         | Source                                                                                                           | Verified by       |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------- |
| Workspace name "PIA Workspace"                                                  | `apps/api/src/routes/web.ts:108` shell placeholder; only workspace-shell value present in baseline               | static read       |
| Conversation modes ASK / RESEARCH / ANALYZE / PLAN / EXECUTE / LEARN            | `apps/web/src/pages/conversation-list.ts:25-30`; matches prototype `interactive/index.html:344-349`              | static read       |
| Document statuses READY / INGESTING / FAILED / UPLOADED / PENDING / QUARANTINED | `apps/web/src/pages/document-list.ts:99-103` + `apps/web/src/pages/shared.ts:40-47`                              | static read       |
| Citation chip shape `[N]` and chip-rendering function                           | `apps/web/src/pages/conversation-detail.ts:100-104`; matches prototype `interactive/index.html:122-124, 139-141` | static read       |
| Run-state badge map (COMPLETED, STREAMING, …)                                   | `apps/web/src/pages/conversation-detail.ts:330-338`; `styles.css:253-261`                                        | static read       |
| Feedback category list (8 values)                                               | `apps/web/src/pages/conversation-detail.ts:84` + `packages/contracts/src/index.ts:514-522`                       | static read       |
| Sample assistant text (retention period)                                        | `evals/answers/datasets/sample.yaml:29`                                                                          | static read       |
| Multi-citation sample (AI + weather)                                            | `evals/answers/datasets/sample.yaml:65-66`                                                                       | static read       |
| 393×852pt viewport + safe-area meta                                             | `apps/web/src/pages/shared.ts:164` (lacks `viewport-fit=cover`; will need update)                                | static read       |
| iPhone 16 Pro dynamic-island 124×37pt centered 11pt from top                    | iOS HIG + Apple developer docs                                                                                   | external standard |
| Live runtime on :3000                                                           | `.ui-redesign/evidence/automated/http-baseline-probes.json`                                                      | HTTP probe        |

## Problem

The Personal Intelligence and Action Engine is currently a server-rendered HTML shell with inline token-less CSS (`apps/web/src/pages/shared.ts:8-66`), no PWA assets, no mobile-first layout, and no bottom navigation. On iPhone 16 Pro the `<table>`-based lists do not reflow at 393pt, the citation `<dialog>` is not thumb-reachable, the top "tab-bar" of 4 horizontal anchors is squeezed by the Dynamic Island, and `JSON.stringify(locator)` leaks debug content into search results (`PIA-MUR-D-002` §4).

Stream's premise: in a retrieval-augmented chat product, the **conversation is the primary work surface**, and the documents / search are inputs to the conversation, not destinations. The visual system minimises nav chrome and lets the message thread breathe; the FAB is the only creation entry, the citation chips are footnote-style text markers (matching the existing `[N]` shape), and the workspace switcher lives in the header avatar (T4=A).

## Constraints (non-negotiable)

- All 7 trade-off recommendations T1=A through T7=A from `PIA-MUR-D-002` §9.
- All 10 acceptance criteria A1–A10 from `PIA-MUR-D-002` §10 acknowledged.
- 6 blockers B-1–B-6 acknowledged. **B-1 is now RESOLVED as of 2026-06-14** per `.ui-redesign/state/workflow-state.json#b1_resolution` (iPhone 16 Pro available; Tailscale primary; cloudflared authorized for installed-PWA).
- 17 out-of-scope items from `PIA-MUR-D-002` §7 acknowledged; in-scope items 14 (`JSON.stringify(locator)`) and 15 (`window.confirm()`) noted for the design contract.
- 393×852pt portrait viewport; env(safe-area-inset-\*) required.
- Concepts are visual prototypes only; no product code modified.

## Materially different alternatives (the other two concepts)

- **Concept 1 — "Calm"** (PIA-MUR-D-003a): 3-tab bar; system font; hairline dividers; no custom icons; workspace is a header affordance; default landing is Conversations. Calm treats the 3 tabs as symmetric peers.
- **Concept 2 — "Workspace"** (PIA-MUR-D-003b): 4-tab bar with a dedicated Workspace tab; warm-neutral background (`#F5F3EE`); blue PIA accent on cards and FAB; default landing is Documents.

Stream differs from Calm on visual identity (single PIA blue accent + footnote chips vs monochrome neutral + filled pills), type scale (19pt body vs 17pt), and signature motion (280ms sheet slide-up via CSS variable vs 250ms hard-coded). Stream differs from Workspace on tab count (3 vs 4), default landing (Conversations vs Documents), and the role of the workspace (header avatar vs peer tab).

## Recommendation (do not pick — present trade-offs)

**Stream** is the most conversation-first of the three concepts. It treats the conversation tab as the dominant surface and uses sheet-heavy navigation (citation, mode, feedback, workspace-switcher — all bottom sheets) to keep the user "in" the thread. The footnote-style `[N]` chips preserve the existing baseline shape, making Stream the **lowest-risk concept** to implement.

The user should pick Stream if: the conversation tab is by far the most frequent entry point, and the team wants the entire product to read as a "chat with citations" experience. The user should pick Calm if: accessibility is the primary gate and a monochrome neutral identity is preferred. The user should pick Workspace if: brand distinctiveness and tab-bar density (4 tabs) are the priority, or if most users have ≥ 3 workspaces.

## Device behavior

- **Safe-area:** All interactive elements respect `env(safe-area-inset-*)` in CSS (top, bottom, left, right). The bottom tab bar uses `49pt + env(safe-area-inset-bottom, 0px)` for the bar height. The composer (T5) is `sticky` with `bottom: var(--tab-bar-safe)`.
- **Dynamic Island:** Persistent content starts at ≥ 60pt from the top; the network-loss banner (T6) lives at 60pt (below the 47pt safe area + 13pt clearance).
- **Touch targets:** All interactive elements are ≥ 44pt; the FAB is 56pt; the Send button is 56pt; the citation chip is a 16pt visible glyph with a 44pt transparent tap area; each tab is 131pt wide on a 393pt viewport (well above 44pt).
- **Thumb reach:** Tab bar (49pt + safe area 34pt = 83pt), FAB (right-side, 16pt from edge), and Send (right of composer) are all in the bottom 50% of the viewport.
- **Installed PWA:** The in-app back chevron replaces the missing Safari back gesture; the app must survive a full-screen relaunch. The Tabs (Conversations / Documents / Search) are the only nav; the workspace switcher is the header avatar.

## Accessibility

- **Landmarks:** `<header role="banner">`, `<nav role="navigation" aria-label="Primary">`, `<main role="main">`, `<aside class="dev-controls" aria-label="…">` (non-product).
- **Rotor:** Headings descend. Citation chips are buttons with `aria-label="Citation 1 of 2, claims: …, button"`. The message thread has `role="log"` + `aria-live="polite"`.
- **Reduce motion:** All animations defined as CSS variables (`--motion-sheet: 280ms`, `--motion-fade: 200ms`); reduce-motion sets both to `0.01ms`. The motion-spec table (`evidence/source-file-changes.md`) is the single source of truth.
- **Dynamic Type:** `--t-body` scales 19pt → 34pt at AX5. At AX5, the conversation list becomes shorter (4-5 rows per screen instead of 5-6); the message thread reflows as 2-line-per-message instead of 1-line; the sheet uses 24pt section title and 14pt caption tokens.
- **Color contrast:** Body `#0A0A0A` on `#FFFFFF` = 19.3:1 (AAA). Accent `#2563EB` on white = 4.6:1 (AA pass for body text ≥ 18pt; AA Large for < 18pt requires `#1D4ED8` = 6.1:1). **The Stream prototype uses `--accent-pressed: #1D4ED8` for the FAB and primary buttons that contain body text** to keep contrast at AA. **UNVERIFIED in dark mode.**
- **VoiceOver:** Citation chip label is "Citation 1 of 2, claims: The retention period is 7 years, button". The mode dot is `aria-hidden="true"`; the mode name is read from the row text.
- **External keyboard:** Tab traverses in DOM order; sheets are focus-trapped (manual focus trap in `app.js`); `Esc` closes sheets.

## Performance

- **Bundle size:** The interactive prototype uses inline SVG, plain CSS, vanilla JS, and the system font. No framework, no icon font, no font fetch.
- **Reflow cost:** The active-tab top accent (2pt) repaints on tab switch. The sheet slide-up animates a `transform` (compositor-only). The mode dot is a static `border-radius: 50%` element.
- **SSE pacing:** The streamed text is appended in a single frame per delta (mirrors `appendAssistantDelta` at `conversation-detail.ts:305-318`). The 30+ citation stutter flagged in `PIA-MUR-D-002` §6 is mitigated by Stream's footnote-style chips, which do not require a pill background or `border-radius` calculation per chip.
- **First paint:** The system font is used; no font fetch blocks FCP. The header is rendered before the conversation list (synchronous HTML). The conversation list rows are in the initial HTML; no client-side fetch is required for the default landing.
- **Memory:** Plain DOM and inline SVG. No virtual list, no intersection observer.

## Dependencies

- **None.** The concept uses only what the product already has: system font, native `<dialog>` (with a `role="dialog"` sheet wrapper for the Stream signature), plain CSS, vanilla JS, inline SVG paths. No new packages, no frameworks.
- **PWA-intent assets (manifest, service worker, apple-touch-icon, theme-color) are NOT in this concept's scope.** Tracked separately at the PWA-intent rows of the parity matrix.

## Backend, API, data, and route effects

- **Backend:** None.
- **API:** None for the in-app redesign. **However, the workspace switcher flow (T4=A via header avatar) requires a `POST /v1/me/active-workspace` endpoint that does not exist in the current OpenAPI contract (37 operations).** This is a known gap; the design contract will flag it; the implementation contract will not implement the endpoint (it is out of redesign scope per `PIA-MUR-D-002` §7). For the prototype, tapping a non-current workspace surfaces a "Switching workspace" toast and reloads the page.
- **Schema:** None.
- **Routes:** The 6 workspace-scoped HTML routes remain; the redesigned pages render the conversation list as the default landing at the existing `/app` shell route.
- **Data:** None. The concept uses real-data shapes from `packages/contracts/src/index.ts` and the existing fixtures in `evals/answers/datasets/*.yaml`.

## Exact scope (what this concept covers)

- 3-tab bottom bar (Conversations / Documents / Search) with **Conversations as the default landing**.
- Visual treatment of 4 screens: conversation list, conversation detail, document list, search results.
- 2 bottom sheets: citation (blue accent), mode-of-conversation (6 radio rows).
- Tab bar, composer (text + iOS dictation as system affordance), blue FAB, network banner, status badges, footnote-style citation chips, conversation rows, document rows, search result rows.
- 6 SVG screenshots (see "Static evidence" below).
- Interactive prototype (HTML/CSS/JS at `interactive/{index.html,styles.css,app.js}`).
- Annotated source-file change list for the design-contract phase (see `evidence/source-file-changes.md`).
- Default-landing question (Conversations proposed) — see README §"Stream default-landing question".

## What this concept does NOT cover (deferred to other phases)

- The actual implementation in `apps/web/src/pages/`. Concepts are visual prototypes only.
- The PWA-intent assets (manifest, service worker, theme-color, apple-touch-icon, startup image).
- The `apple-mobile-web-app-capable` meta.
- The `POST /v1/me/active-workspace` endpoint for switching workspaces.
- The destructive-confirm bottom sheet for `document-detail.ts:159` (replaces `window.confirm()`).
- The output of the FE parse step in `search.ts:131` (`JSON.stringify(locator)`).
- The document detail page (chunks view) — Stream shows the document list, not the detail page; the detail page is a separate design-contract task.

## Acceptance criteria (for this concept to be selected)

- **AC1.** Renders correctly at 393×852pt portrait (no horizontal scroll, no clipped content); all interactive elements respect `env(safe-area-inset-*)`.
- **AC2.** Bottom tab bar shows exactly 3 tabs (Conversations / Documents / Search); the **Conversations** tab is `aria-current="page"` on first load. Tapping a tab switches `data-screen` and the active accent; tapping the active tab is a no-op.
- **AC3.** The default landing is **Conversations**; the user can override this in the decision packet. The conversation list shows: title, relative time, mode dot, mode name, and citation preview per row. The active conversation is highlighted with a `--selection` background.
- **AC4.** The bottom-sheet citation modal (T2=A) renders source, locator (as `page N`, not `JSON.stringify`), verification status, and the claim with a blue left border. The "Open source" button uses `--accent` for the primary action.
- **AC5.** The network banner (T6=A) appears when the dev "Offline" toggle is on, and disables the FAB (40% opacity) and Send button (`disabled` attribute + `opacity: 0.4`).
- **AC6.** The FAB (T7=A) appears on Conversations and Documents tabs; the Conversations FAB opens the mode-of-conversation sheet (6 radio rows) and the Documents FAB opens the upload sheet. The FAB uses `--accent` background with a 56pt circle and a `0 6pt 20pt rgba(37,99,235,0.36)` drop shadow.
- **AC7.** The composer (T5=A) is text-only; there is no mic button. The iOS keyboard dictation affordance (the system mic key on the iOS keyboard) is the only dictation entry point. The composer grows with content (max 8 lines).
- **AC8.** `prefers-color-scheme: dark`, `prefers-reduced-motion: reduce`, and AX5 (Larger Text) all switch the prototype's appearance with no layout breakage. The accent darkens to `--accent: #3B82F6` in dark mode; the body text inverts to `#F5F5F5`; motion durations collapse to `0.01ms`; body type scales 19pt → 34pt.
- **AC9.** Citation chips are footnote-style text markers (`[1]`, `[2]`) — no background pill, no border, no box-shadow. The visible glyph is 16pt with a 44pt transparent tap area. The chip color is `--accent`; the underline animates from `scaleX(0.5)` to `scaleX(1)` on `:hover`/`:focus-visible`.
- **AC10.** No invented data: every label, status, mode, workspace, and citation comes from `apps/web/src/pages/*`, `packages/contracts/src/index.ts`, or `evals/answers/datasets/sample.yaml`.
- **AC11.** The motion spec is the single source of truth: all sheet/tab/row/FAB/network-banner durations are defined as CSS variables (`--motion-sheet`, `--motion-fade`); no JS reads them. The spec is in `evidence/source-file-changes.md` §"Stream — Motion spec".

## Response syntax

The orchestrator should accept this packet by recording the decision in `.ui-redesign/decisions/DECISION_LEDGER.md` as `PIA-MUR-D-003c` with the user's pick (RECOMMENDED, ACCEPTED, REJECTED, or REVISED) and a one-line rationale. The user MUST also pick a default-landing tab. On `ACCEPTED`, the next phase is `design-contract`. On `REJECTED`, the user picks from `PIA-MUR-D-003a` (Calm) or `PIA-MUR-D-003b` (Workspace). On `REVISED`, the orchestrator returns the user-supplied revisions and the visual-concept-prototyper regenerates this concept to address them.

---

**UNVERIFIED items (mirrored from `PIA-MUR-D-002` §10):**

- iOS 16 Pro Safari focus-management behavior of native `<dialog>` `showModal()`. **Now actionable**: B-1 resolved 2026-06-14; iPhone-interaction-specialist or real-ui-product-tester can verify against the real device.
- `prefers-reduced-motion` media-query support in iOS 16 Pro installed PWA mode. **Now actionable** for the same reason.
- Color-contrast ratios of badge classes in dark mode (estimates; needs automated axe-core check).
- The new `POST /v1/me/active-workspace` endpoint for switching workspaces (out of redesign scope; flagged for the design contract).
- **Touch-target bounding-box sizes** (citation chip 16pt glyph / 44pt tap area; verified by reading `styles.css:471-500`, not by device measurement) — flagged for `device-validation`.
- **Physical iPhone 16 Pro availability** — **B-1 RESOLVED 2026-06-14** per `.ui-redesign/state/workflow-state.json#b1_resolution`. Downstream `device-validation` is now unblocked.
