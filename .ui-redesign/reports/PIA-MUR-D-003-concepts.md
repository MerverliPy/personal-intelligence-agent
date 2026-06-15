# PIA-MUR-D-003 — Consolidated Concept Report

**Status:** `PROPOSED` (awaits user pick between Concept 1, 2, and 3)
**Phase:** `concept-production` (after `PIA-MUR-D-002` approval; before `design-contract`)
**Parent decision:** PIA-MUR-D-002 (product model)
**Target device:** iPhone 16 Pro portrait, 393×852pt logical viewport, installed PWA (primary) + Safari (secondary)
**Network requirement:** Network-required PWA; no offline scope
**Concept-pick gate:** `PIA-MUR-D-003` is the orchestrator's parent pick; each concept has its own sub-decision (`PIA-MUR-D-003a`, `-003b`, `-003c`)
**Honors:** T1=A, T2=A, T3=A, T4=A, T5=A, T6=A, T7=A — all three concepts honor the full product model

---

## 1. Per-concept summary

### 1.1 Concept 1 — "Calm" (PIA-MUR-D-003a)

- **Folder:** `.ui-redesign/concepts/concept-1-calm/`
- **Thesis:** Monochrome-neutral, low-chrome, accessibility-first. The product reads as iOS-native: system font, hairline dividers, no custom icons, the only color is `--ink` (`#0A0A0A`). The conversation tab is the default landing, but the 3 tabs are treated as symmetric peers — no tab is visually dominant.
- **Artifacts created:**
  - `README.md` (76 lines)
  - `decision-packet.md` (144 lines, 11 acceptance criteria)
  - `interactive/{index.html, styles.css, app.js}` (full prototype)
  - `screenshots/01-conversation-list.svg` through `08-annotated-safe-area.svg` (8 SVG screenshots)
  - `evidence/source-file-changes.md`, `evidence/motion-spec.md`, `evidence/safe-area-overlay.md`
- **Static evidence (screenshots):**
  1. `01-conversation-list.svg` — default landing with 5 rows; black FAB
  2. `02-conversation-detail.svg` — user bubble + assistant message with `[1]` `[2]` blue-underline chips
  3. `03-citation-bottom-sheet.svg` — citation sheet with claim blockquote (black left border) + "Open source" black button
  4. `04-document-list.svg` — 5 doc rows with READY / PROCESSING / READY / FAILED / UPLOADED badges
  5. `05-search-results.svg` — sticky single-row search input + 3 result cards
  6. `06-workspace-switcher.svg` — sheet with workspace cards
  7. `07-offline-state.svg` — red banner below Dynamic Island
  8. `08-annotated-safe-area.svg` — annotated safe-area overlay (educational)
- **Interactive evidence (screens + interactions):**
  - **Screens (4):** Conversation list, conversation detail, document list, search results
  - **Interactions:** Tab switch (with active accent + 2pt top bar), row tap (highlight), FAB tap (mode sheet for Conversations / upload sheet for Documents), citation chip tap (citation sheet), back button, dev toggles for Offline / Dark / Reduce-motion / AX5 / Reset viewport
  - **Tab bar:** 3 tabs (Conversations / Documents / Search), 1/3 width each
- **Trade-offs vs. the other concepts:**
  - vs. Workspace: 3 tabs not 4 (T1=A baseline); black-and-white identity; default landing is Conversations (same as Stream, not Documents).
  - vs. Stream: monochrome neutral vs single PIA blue; 17pt body vs 19pt; filled pill citation chips vs footnote-style text chips; 250ms hard-coded sheet duration vs 280ms CSS-variable sheet duration.

### 1.2 Concept 2 — "Workspace" (PIA-MUR-D-003b)

- **Folder:** `.ui-redesign/concepts/concept-2-workspace/`
- **Thesis:** Treat the workspace as a first-class surface. The 4-tab bar adds a dedicated "Workspace" tab (S2 in `PIA-MUR-D-002` §3) so users with ≥ 3 workspaces can switch by tab, not by header-avatar sheet. Warm-neutral background (`#F5F3EE`); blue PIA accent on cards, FAB, and primary buttons. The Documents tab is the default landing.
- **Artifacts created:**
  - `README.md` (76 lines)
  - `decision-packet.md` (124 lines, 11 acceptance criteria)
  - `interactive/{index.html, styles.css, app.js}` (full prototype)
  - `screenshots/01-document-list.svg` through `07-offline-state.svg` (7 SVG screenshots)
  - `evidence/source-file-changes.md`, `evidence/motion-spec.md`, `evidence/default-landing.md`
- **Static evidence (screenshots):**
  1. `01-document-list.svg` — default landing; 12pt-radius cards with 32pt icon + status pill + sensitivity + version + size; settings cog in header
  2. `02-workspace-tab.svg` — workspace list with cards
  3. `03-conversation-list.svg` — conversation list (non-default)
  4. `04-conversation-detail.svg` — user bubble + assistant message with filled blue `[1]` pill chips
  5. `05-citation-bottom-sheet.svg` — citation sheet with blue left border + "Open source" blue button
  6. `06-search-results.svg` — search results
  7. `07-offline-state.svg` — red banner below Dynamic Island
- **Interactive evidence (screens + interactions):**
  - **Screens (5):** Document list (default), workspace list, conversation list, conversation detail, search results
  - **Interactions:** Same as Calm + workspace-tab switch + workspace-card tap (triggers a "Switching workspace" toast — endpoint not in current OpenAPI; flagged in evidence)
  - **Tab bar:** 4 tabs (Documents / Search / Conversations / Workspace), 1/4 width each
- **Trade-offs vs. the other concepts:**
  - vs. Calm: 4 tabs not 3 (T1=A as a 4-tab variant); warm-neutral identity vs monochrome; filled blue citation pills vs blue-underline text chips; Documents default landing vs Conversations.
  - vs. Stream: 4 tabs not 3; warm-neutral background vs white; Documents default landing vs Conversations; workspace as peer tab vs header avatar; settings cog in header vs minimal header.

### 1.3 Concept 3 — "Stream" (PIA-MUR-D-003c)

- **Folder:** `.ui-redesign/concepts/concept-3-stream/`
- **Thesis:** Conversation-first, content-forward. The conversation tab is the default landing and the visual identity of the app. The premise: in a retrieval-augmented chat product, the conversation is the primary work surface, and the documents / search are inputs to the conversation, not destinations. The visual system minimises nav chrome and lets the message thread breathe; the FAB is the only creation entry; the citation chips are footnote-style text markers (matching the existing `[N]` shape from `apps/web/src/pages/conversation-detail.ts:100-104`); the workspace switcher lives in the header avatar (T4=A).
- **Artifacts created:**
  - `README.md` (76 lines, pre-existing)
  - `decision-packet.md` (167 lines, 11 acceptance criteria — created in this run)
  - `interactive/{index.html, styles.css, app.js}` (full prototype, pre-existing)
  - `screenshots/01-conversation-list.svg` through `06-offline-state.svg` (6 SVG screenshots — created in this run)
  - `evidence/source-file-changes.md` (combined motion-spec + source-file-changes, 145 lines — created in this run)
- **Static evidence (screenshots):**
  1. `01-conversation-list.svg` — default landing; 5 rows with mode dot (6pt), title, mode name, citation preview; selected row with `--selection` (`#DBE7FF`) background
  2. `02-conversation-detail.svg` — user bubble (PIA blue, 18pt radius) + assistant message with footnote `[1]` `[2]` blue-underline chips (16pt glyph) + COMPLETED badge + 231 ms + Feedback link
  3. `03-citation-bottom-sheet.svg` — citation sheet with eyebrow "CITATION 1 OF 2", `Source / Locator / Verification` dl, claim blockquote with blue left border, blue "Open source" primary button
  4. `04-document-list.svg` — 5 doc rows with 32pt file icon (PIA blue stroke; `#991B1B` for FAILED) + status pill + sensitivity + version + chevron
  5. `05-search-results.svg` — sticky single-row search input (44pt, 12pt-radius) + 4 result cards with rank + excerpt + status + locator + single `Fuse 0.943` chip
  6. `06-offline-state.svg` — red banner below Dynamic Island; conversation rows at 55% opacity; FAB at 40% opacity (disabled)
- **Interactive evidence (screens + interactions):**
  - **Screens (4):** Conversation list (default), conversation detail, document list, search results
  - **Interactions:** Same as Calm + citation-chip underline reveal (`scaleX(0.5)` → `scaleX(1)` on `:hover`/`:focus-visible`); sheet slide-up via `--motion-sheet: 280ms` CSS variable (longer than Calm's 250ms; the signature motion is also the single most reduce-motion-aware: a single token change disables all sheets)
  - **Tab bar:** 3 tabs (Conversations / Documents / Search), 1/3 width each — same as Calm
- **Trade-offs vs. the other concepts:**
  - vs. Calm: white background + PIA blue accent vs monochrome neutral; 19pt body vs 17pt (larger, more visual weight on the conversation); footnote-style text chips vs filled black citation chips; CSS-variable motion tokens vs hard-coded keyframe durations; same default landing (Conversations); same 3-tab count.
  - vs. Workspace: 3 tabs not 4; white background vs warm-neutral; PIA blue as the only accent vs PIA blue on cards only; footnote chips vs filled blue pills; same default landing as Calm (Conversations, not Documents); workspace is header avatar vs peer tab.

---

## 2. Concepts differ on

| Dimension                                 | Concept 1 — Calm                                                                                                                   | Concept 2 — Workspace                                                                                                          | Concept 3 — Stream                                                                                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Visual style**                          | Monochrome neutral; system font; hairline dividers; only `--ink` (`#0A0A0A`); no custom icons; 17pt body                           | Warm-neutral (`#F5F3EE`); blue PIA accent on cards + FAB; 12pt-radius cards with elevation; 17pt body                          | White (`#FFFFFF`); single PIA blue accent (`#2563EB`); inline SVG icons; 19pt body (largest)                                                                                                  |
| **Density**                               | High (5-6 rows per screen; smaller type)                                                                                           | Medium (cards with elevation; 4 rows per screen)                                                                               | Medium (5 rows per screen; larger type)                                                                                                                                                       |
| **Navigation emphasis (default landing)** | Conversations (3 tabs, symmetric)                                                                                                  | **Documents** (4 tabs; Documents first)                                                                                        | **Conversations** (3 tabs, conversation-first)                                                                                                                                                |
| **Motion / micro-interactions**           | 250ms hard-coded sheet; reduce-motion to 0.01ms; row highlight on press                                                            | 280ms hard-coded sheet; reduce-motion to 0.01ms; card elevation static                                                         | **280ms CSS-variable sheet** (`--motion-sheet`); reduce-motion to 0.01ms; **footnote-chip underline reveal** (`scaleX(0.5)` → `scaleX(1)`) on `:hover`/`:focus-visible`                       |
| **Error/empty handling**                  | Inline red FAILED badge; offline banner disables FAB + Send; native `<dialog>` for citation                                        | Inline red FAILED badge; destructive-confirm sheet; offline banner; **workspace switcher toast fallback for missing endpoint** | Inline red FAILED badge; offline banner disables FAB (40% opacity) + Send; sheet wrapper around `<dialog>` to avoid z-index conflict with FAB                                                 |
| **Dark-mode behavior**                    | `--bg: #0A0A0A`, `--fg: #F5F5F5`; black-on-black inversion; 100ms color transition                                                 | `--bg: #0A0A0A`, `--ink: #F5F5F5`; cards darken to `#1F1B1F`; blue accent to `#3B82F6`                                         | `--bg: #0A0A0A`, `--fg: #F5F5F5`; divider to `#1F1F1F`; blue accent to `#3B82F6`; `--selection: #1E3A5C`                                                                                      |
| **A11y emphasis**                         | **Highest** — monochrome removes a class of contrast issues; system font respects Dynamic Type natively; no custom colors to audit | Medium — warm-neutral has good contrast (14.8:1) but introduces one more color to audit; custom card shadow must be checked    | Medium-high — single accent is a smaller contrast surface than Workspace's two-tone cards; footnote chips preserve the existing `renderCitationChipClient` shape (lowest implementation risk) |
| **Install-to-Home-Screen UX**             | Header is minimal (avatar + title); no settings cog on the in-app header                                                           | Header has a settings cog (top-right); more chrome to absorb in standalone mode                                                | Header is minimal (avatar + title); no settings cog; the most standalone-friendly of the three                                                                                                |

---

## 3. What every concept implements

All three concepts honor the full product model from `PIA-MUR-D-002` §9 (T1–T7) and the iPhone-specific priorities from `PIA-MUR-D-002` §5. No concept diverges from these constraints.

### Trade-offs T1–T7 (from `PIA-MUR-D-002` §9)

- **T1 (Primary navigation pattern) = A** — bottom tab bar. Calm and Stream implement the 3-tab variant; Workspace implements the 4-tab variant (explicitly accepted as a 4-tab variant in `PIA-MUR-D-002` §3 S2 and `PIA-MUR-D-003b`).
- **T2 (Conversation detail layout) = A** — single-pane with bottom-sheet citation modal. All three concepts use a single-pane thread with a slide-up citation sheet.
- **T3 (Search placement) = A** — dedicated bottom tab. All three concepts have a Search tab (3rd tab in Calm/Stream, 2nd tab in Workspace).
- **T4 (Workspace switcher placement) = A** — top-left avatar in header (iOS Mail pattern). Calm and Stream use the header avatar; Workspace adds an _additional_ 4th tab as a peer, but the avatar is still present in the header (the tab is additive, not a replacement).
- **T5 (Voice / text mode for input) = A** — text-only. All three concepts have a text-only composer with iOS dictation as the system affordance. No mic button.
- **T6 (Network-loss behavior) = A** — persistent top banner + disable destructive actions. All three concepts render a red banner at 60pt from the top and disable the FAB and Send button when offline.
- **T7 (+ Upload / New conversation trigger) = A** — FAB on Documents / Conversations tabs. All three concepts have a 56pt circular FAB in the bottom-right; the Documents FAB opens an upload sheet and the Conversations FAB opens a mode-of-conversation sheet.

### iPhone-specific priorities (from `PIA-MUR-D-002` §5)

- **Safe-area insets + Dynamic Island** — all three use `env(safe-area-inset-*)` in CSS (top, bottom, left, right). The bottom tab bar uses `49pt + env(safe-area-inset-bottom, 0px)` (or `56pt` for Workspace) for the bar height.
- **Thumb reach** — primary actions (FAB, Send, tab bar) are in the bottom 50% of the viewport in all three concepts.
- **Touch target size** — 44×44pt minimum (HIG) is met by all interactive elements in all three concepts. Citation chips preserve a 44pt transparent tap area around a 16pt visible glyph (Stream) or a 22×22pt visible pill (Calm/Workspace).
- **`viewport-fit=cover`** — required for edge-to-edge; the `<meta>` tag change is the same line (`apps/api/src/routes/web.ts:25`) in all three concepts' source-file-changes lists.
- **Reduce motion** — all three set durations to `0.01ms` when `prefers-reduced-motion: reduce` is set; Stream additionally uses CSS variables for motion tokens so a single token change disables all sheets.
- **Dark mode** — all three define `prefers-color-scheme: dark` token overrides and a `.theme-dark` class for dev toggles.
- **Dynamic Type (AX5)** — all three scale `--t-body` (17pt or 19pt → 31pt or 34pt at AX5). Calm's monochrome neutral is the most resilient to Dynamic Type because there are no custom colors to scale.
- **External keyboard** — all three set `tabindex="0"` on rows and have a manual focus trap in the sheet JS; `Esc` closes sheets.
- **Network-required PWA** — all three render a T6 banner; none implements an offline mode; none caches conversation state locally.

---

## 4. Acceptance criteria for the concept-selection gate (PIA-MUR-D-003)

The concept-selection gate is approved when **all** of the following are true:

- **AC1.** The user has confirmed or overridden the default-landing tab for the selected concept (Calm = Conversations; Workspace = Documents; Stream = Conversations).
- **AC2.** The user has accepted one of the three concepts as `RECOMMENDED`, `ACCEPTED`, `REJECTED`, or `REVISED` in `.ui-redesign/decisions/DECISION_LEDGER.md` with a one-line rationale.
- **AC3.** The selected concept's decision-packet (one of `PIA-MUR-D-003a`, `-003b`, `-003c`) has been recorded in the decision ledger with the user's pick and the user-specified default landing.
- **AC4.** All 6 SVG screenshots for the selected concept exist in `.ui-redesign/concepts/<selected>/screenshots/` at 393×852pt and use the same visual style as the corresponding interactive prototype.
- **AC5.** The selected concept's interactive prototype (`interactive/{index.html, styles.css, app.js}`) renders correctly with the 7 evidence toggles (Offline, Dark mode, Reduce motion, AX5, Reset viewport, tab switch, sheet open).
- **AC6.** The selected concept's `evidence/source-file-changes.md` is reviewed and the orchestrator confirms that no product code was modified (concepts are visual prototypes only).
- **AC7.** The user has confirmed that the "what every concept implements" list (Section 3 above) accurately reflects the product model — no concept silently diverges from T1–T7 or the iPhone-specific priorities.
- **AC8.** The orchestrator records the concept pick in `.ui-redesign/state/workflow-state.json` and updates the workflow phase from `concept-production` to `design-contract` (with the note that the `mobile-ui-design-contract` command is missing and the orchestrator must dispatch directly).

---

## 5. UNVERIFIED claims list

This list mirrors the UNVERIFIED list in `PIA-MUR-D-002` §10 and adds one item specific to the concept-phase deliverables. **B-1 is now RESOLVED as of 2026-06-14** per `.ui-redesign/state/workflow-state.json#b1_resolution`.

- **UNVERIFIED-1.** iOS 16 Pro Safari focus-management behavior of native `<dialog>` `showModal()`. **Status: B-1 RESOLVED 2026-06-14** — iPhone 16 Pro is available; iPhone-interaction-specialist or real-ui-product-tester can verify against the real device in the `device-validation` phase.
- **UNVERIFIED-2.** `prefers-reduced-motion` media-query support in iOS 16 Pro installed PWA mode. **Status: B-1 RESOLVED 2026-06-14** — same.
- **UNVERIFIED-3.** Color-contrast ratios of badge classes in dark mode (estimated by inspection of `apps/web/src/pages/shared.ts:40-47` and the three concept `styles.css` files; needs an automated axe-core check). **Status: still unverified** — requires B-6 (Playwright + axe-core dependency approval) before the G7 gate can be run.
- **UNVERIFIED-4.** Touch-target bounding-box sizes (citation chip 16pt visible glyph / 44pt tap area in Stream; 22×22pt visible pill / 44pt tap area in Calm and Workspace). **Status: still unverified by device measurement** — verified by reading `styles.css` only; flagged for `device-validation` (now unblocked by B-1).
- **UNVERIFIED-5.** Physical iPhone 16 Pro availability and reachability — **B-1 RESOLVED 2026-06-14**. Tailscale primary bridge (`http://100.81.83.98:3000`) for Safari browser testing; cloudflared quick-tunnel for installed-PWA validation when HTTPS is required.
- **UNVERIFIED-6 (concept-specific).** The three concept's interactive prototypes have not been opened in a real iPhone 16 Pro Safari session. The screenshots are hand-crafted SVGs that match the CSS rendering but are not pixel-perfect browser captures. **Status: still unverified** — the `device-validation` phase must open each prototype in Safari (Tailscale) and capture real screenshots.

---

## 6. Dependencies, backend, API, route, and data effects

**Empty for concept work.** Concepts are visual prototypes only. The adapter (`PIA-MUR-ADAPTER-001`) does not authorize any product-code, dependency, schema, route, API, auth, infra, or deployment change. The `source-file-changes.md` evidence files in each concept's `evidence/` directory are _read-only inspection_ — they list the lines the design contract and implementation contract would touch, but the concepts themselves do not implement those changes.

- **Dependencies:** None. Each prototype uses inline SVG, plain CSS, vanilla JS, and the system font. No new packages, no frameworks, no icon fonts.
- **Backend:** None.
- **API:** None. (The `POST /v1/me/active-workspace` endpoint flagged in `PIA-MUR-D-003b` §"Backend, API, data, and route effects" is _out of redesign scope_ per `PIA-MUR-D-002` §7 item 1; the design contract will surface this gap but the implementation contract will not implement the endpoint.)
- **Routes:** None. The 6 workspace-scoped HTML routes remain; the redesigned pages render at the existing `/app` shell route.
- **Data:** None. The prototypes use real-data shapes from `packages/contracts/src/index.ts` and existing fixtures in `evals/answers/datasets/*.yaml`. No new fixtures, no mock data, no fabricated workspaces or personas.

---

## 7. Per-concept artifact inventory (canonical paths)

### Concept 1 — Calm

```
.ui-redesign/concepts/concept-1-calm/
├── README.md
├── decision-packet.md (144 lines, 11 ACs)
├── interactive/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── screenshots/
│   ├── 01-conversation-list.svg
│   ├── 02-conversation-detail.svg
│   ├── 03-citation-bottom-sheet.svg
│   ├── 04-document-list.svg
│   ├── 05-search-results.svg
│   ├── 06-workspace-switcher.svg
│   ├── 07-offline-state.svg
│   └── 08-annotated-safe-area.svg
└── evidence/
    ├── source-file-changes.md
    ├── motion-spec.md
    └── safe-area-overlay.md
```

### Concept 2 — Workspace

```
.ui-redesign/concepts/concept-2-workspace/
├── README.md
├── decision-packet.md (124 lines, 11 ACs)
├── interactive/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── screenshots/
│   ├── 01-document-list.svg
│   ├── 02-workspace-tab.svg
│   ├── 03-conversation-list.svg
│   ├── 04-conversation-detail.svg
│   ├── 05-citation-bottom-sheet.svg
│   ├── 06-search-results.svg
│   └── 07-offline-state.svg
└── evidence/
    ├── source-file-changes.md
    ├── motion-spec.md
    └── default-landing.md
```

### Concept 3 — Stream (this run)

```
.ui-redesign/concepts/concept-3-stream/
├── README.md (76 lines, pre-existing)
├── decision-packet.md (167 lines, 11 ACs — created this run)
├── interactive/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── screenshots/                                        ← created this run
│   ├── 01-conversation-list.svg
│   ├── 02-conversation-detail.svg
│   ├── 03-citation-bottom-sheet.svg
│   ├── 04-document-list.svg
│   ├── 05-search-results.svg
│   └── 06-offline-state.svg
└── evidence/
    └── source-file-changes.md (145 lines, combined motion-spec + source-file-changes — created this run)
```

---

## 8. Source-of-evidence index

- `.ui-redesign/adapter/REPOSITORY_ADAPTER.md` (PIA-MUR-ADAPTER-001, APPROVED) — product purpose, primary user classes, critical outcomes, network/PWA intent, protected areas, git policy, device matrix.
- `.ui-redesign/baseline/REPOSITORY_BASELINE.md` (PIA-MUR-D-001) — runtime evidence, PWA and mobile evidence, security headers, source-code baseline, P3-GATE inheritance, open gaps, blocker status.
- `.ui-redesign/reports/PIA-MUR-D-002-product-model.md` — product model, T1–T7 trade-offs, A1–A10 acceptance criteria, B-1–B-6 blockers, UNVERIFIED items §10.
- `.ui-redesign/state/workflow-state.json` — `b1_resolution` block: B-1 RESOLVED 2026-06-14, iPhone 16 Pro available, Tailscale primary, cloudflared authorized.
- `.ui-redesign/decisions/DECISION_LEDGER.md` — approved decisions PIA-MUR-D-001 and PIA-MUR-D-002; this report will produce PIA-MUR-D-003 (parent pick) plus PIA-MUR-D-003a/b/c (per-concept picks).
- `.ui-redesign/contracts/FEATURE_PARITY_MATRIX.md` — 16 rows; concepts honor rows 1–8 (current screens) and defer rows 9–16 (PWA-intent, /auth/logout, /openapi.yaml) to the design contract.
- `.ui-redesign/evidence/automated/http-baseline-probes.json` — public routes, workspace routes, API routes, auth routes, PWA assets (all 404), HTML evidence, security headers.
- `apps/web/src/pages/conversation-detail.ts:100-104` — `renderCitationChipClient` shape (`[N]`); preserved as-is by Stream; replaced with a filled pill by Calm and Workspace.
- `apps/web/src/pages/conversation-list.ts:25-30` — 6-mode `<select>`; rendered as a sheet of radio rows by all three concepts.
- `apps/web/src/pages/document-list.ts:99-103` + `apps/web/src/pages/shared.ts:40-47` — status badge classes; preserved by all three concepts.
- `apps/web/src/pages/conversation-detail.ts:170-172` — source-locator rendering (`page N`); preserved by all three concepts.
- `apps/web/src/pages/search.ts:131` — `JSON.stringify(locator)` debug string; in-scope for the design contract (`PIA-MUR-D-002` §7 item 14).
- `apps/web/src/pages/document-detail.ts:158-170` — `window.confirm()` for delete; in-scope for the design contract (`PIA-MUR-D-002` §7 item 15).
- `evals/answers/datasets/sample.yaml:29, 65-66` — sample assistant text and multi-citation sample used in all three prototypes.
- `packages/contracts/src/index.ts:347, 440-449, 514-522` — `ConversationMode`, `Citation`, `FeedbackCategory` — unchanged in all three concepts.
- `planning/runs/P3-GATE.md:42-56` — inherited P3-GATE baseline (921 unit, 13 security, 1 e2e, 11 retrieval, 11 answers).

---

**End of report. The orchestrator should record the user's pick in `.ui-redesign/decisions/DECISION_LEDGER.md` as `PIA-MUR-D-003` (parent) plus `PIA-MUR-D-003a/b/c` (per-concept), then transition the workflow phase from `concept-production` to `design-contract` (orchestrator-dispatched; the `mobile-ui-design-contract` command is missing per `PIA-MUR-D-001` blocker B-2).**
