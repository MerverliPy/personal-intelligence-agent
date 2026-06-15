# PIA-MUR-D-002 — Product-Model Recommendation

**Status:** `PROPOSED` (awaiting user approval)
**Phase:** `product-model` (between `BASELINE_CAPTURED` and `design-contract`)
**Decision ID:** `PIA-MUR-D-002`
**Produced by:** `product-ux-analyst` specialist (read-only)
**Evidence base:** `.ui-redesign/adapter/REPOSITORY_ADAPTER.md` (PIA-MUR-ADAPTER-001, APPROVED); `.ui-redesign/baseline/REPOSITORY_BASELINE.md` (PIA-MUR-D-001); `.ui-redesign/evidence/automated/http-baseline-probes.json`; `.ui-redesign/contracts/FEATURE_PARITY_MATRIX.md`; `docs/00_PRODUCT_REQUIREMENTS.md`; `docs/01_SYSTEM_REQUIREMENTS.md`; `apps/web/src/pages/*.ts`; `apps/api/src/routes/web*.ts`; `api/openapi.yaml`; `AGENT_HANDOFF.md`; `planning/runs/P3-GATE.md:42-56`.
**Target device:** iPhone 16 Pro portrait, Safari + installed PWA (primary); iOS Chrome (secondary); iPhone 15/14/13/SE (compatibility).
**Network:** Online-only. No offline scope. Service worker still useful for fast shell + installability.

---

## 1. Target user outcomes (iPhone 16 Pro portrait, network-required PWA)

Ordered by expected mobile frequency × value. Personas anchored to `docs/00_PRODUCT_REQUIREMENTS.md:28-47` (Owner-operator primary).

| #   | Outcome                                                                                                     | User role                                                       | Trigger                                                       | Minimum viable state on iPhone 16 Pro portrait                                                                                                                                                               | Expected time-to-value (4G/5G cellular)                                                        |
| --- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 1   | **Ask a grounded question in the current workspace and read a streamed answer with citations**              | Owner-operator; Project contributor                             | Conversational intent                                         | Single-pane conversation: input composer at bottom (above keyboard), streamed assistant text above, citation chips inline, run-state badge in header                                                         | First token ≤ 3 s (NFR-PERF-003 in `docs/01_SYSTEM_REQUIREMENTS.md:150`); first citation ≤ 5 s |
| 2   | **Inspect a citation and decide whether the claim is trustworthy**                                          | Owner-operator; Knowledge curator; Security/compliance reviewer | Tap a citation chip                                           | Bottom sheet (thumb-reachable) with: claim text, source document title, version, locator, verification status, "Open source" deep link. Closes with swipe-down or `Esc`/back gesture                         | ≤ 1 s after tap                                                                                |
| 3   | **Submit categorized feedback (POSITIVE / INCORRECT / CITATION_ISSUE / FREE_TEXT) on an assistant message** | Owner-operator; any user role                                   | Tap "Feedback" on any assistant message                       | Inline form on the assistant message, category select first, free-text correction/notes second; submit button at thumb reach; success state via `aria-live` polite                                           | ≤ 2 taps + 1 submit                                                                            |
| 4   | **Resume a recent conversation started on desktop**                                                         | Owner-operator; Project contributor                             | Tapping the installed-PWA icon; deep link from external share | Conversation list: most-recently-updated first, mode chip, title, timestamp, "Continue" affordance; tap → opens detail at last message                                                                       | ≤ 2 s list hydration; ≤ 1 s detail shell                                                       |
| 5   | **Upload a document on the go (photo of a page, PDF from Files, .txt)**                                     | Owner-operator                                                  | Need to add a source while away from desk                     | Sheet (not full page) with: file-picker (camera / Files / iCloud Drive), title field, "Upload" primary button at thumb reach; progress bar inline; "Continue in background" on success                       | Initiate ≤ 1.5 s; signed-URL PUT to S3/MinIO progress visible                                  |
| 6   | **Search the workspace knowledge base to find a source for a known fact**                                   | Owner-operator; Knowledge curator                               | "I remember the doc said X" intent                            | Slide-down search bar OR dedicated tab; results as chunk cards (text + rank + scores + source) with "Open in conversation" deep link                                                                         | Server P95 ≤ 1.5 s; client render ≤ 300 ms                                                     |
| 7   | **Check document ingestion / processing status (PENDING → INGESTING → READY / FAILED)**                     | Owner-operator                                                  | After upload, or background polling                           | Status chips on the document list (already in baseline: `apps/web/src/pages/document-list.ts:99-103`); pull-to-refresh on the list                                                                           | Refresh RTT ≤ 1 s on Wi-Fi                                                                     |
| 8   | **Switch workspace (or sign in / out) and see identity**                                                    | Owner-operator; Workspace admin                                 | Tapping avatar/profile area, or cold-launch sign-in           | Workspace switcher sheet triggered from the top-left avatar/header; lists workspaces with the current one marked; sign-out lives in the same sheet (gated by `/auth/logout` — out of redesign scope, see §7) | Sheet open ≤ 300 ms                                                                            |

Outcomes #1, #2, #3 are the spine; without them the product is "search engine with a chat box" and PR-005/PR-013/PR-015 (`docs/00_PRODUCT_REQUIREMENTS.md:167,177,178`) are not honored.

---

## 2. Critical user flows (ranked for mobile)

| Rank | Flow                                                  | Min taps                         | Components                                                                                            | iPhone-specific risks                                                                                  |
| ---- | ----------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| F1   | **Resume → Ask → Read streamed answer**               | 3 (icon + composer + Send)       | Bottom tab; conversation list; conversation detail with inline composer                               | Dynamic Island + bottom safe-area; keyboard covers composer; network-loss mid-stream                   |
| F2   | **Inspect a citation** (subflow of F1)                | 2 (chip + Close)                 | Bottom sheet or full-screen modal; native `<dialog>` (`apps/web/src/pages/conversation-detail.ts:45`) | Sheet must not collide with home indicator; backdrop tap closes; VoiceOver focus trap                  |
| F3   | **Submit categorized feedback** (subflow of F1)       | 3 (Feedback + Category + Submit) | Inline form on assistant message (`conversation-detail.ts:81-98`)                                     | Native iOS `<select>` picker is large and opaque — bottom-sheet-of-options preferred (design-contract) |
| F4   | **Resume a recent conversation**                      | 2 (icon + row)                   | Conversation list (current route `conversation-list.ts`)                                              | `<table>` does not reflow at 393pt — convert to card list at narrow viewports                          |
| F5   | **Search the knowledge base**                         | 3 (focus + Send + result)        | Search form (`search.ts:13-156`); chunk cards                                                         | `JSON.stringify(locator)` debug string should not ship; score bars belong in detail                    |
| F6   | **Upload a document on the go**                       | 3–6 (FAB + file + Upload)        | Sheet with file picker, title, primary action                                                         | 50 MB cap (`upload.ts:23`); cellular upload gating; iOS file-picker requires user gesture (handled)    |
| F7   | **Switch workspace**                                  | 2 (avatar + row)                 | Workspace switcher sheet                                                                              | Header squeezed by Dynamic Island; sheet must be searchable for ≥ 10 workspaces                        |
| F8   | **Approve a consequential tool action** (rare in MVP) | 2 (review + Approve)             | Full-screen approval sheet (FR-TOOL-004)                                                              | Face ID / device passcode confirmation; Dynamic Type on approval text                                  |

---

## 3. Information architecture recommendation (alternatives, not a pick)

### Primary navigation

- **A. Bottom tab bar (3–4 tabs)** — iOS-native; thumb-reachable; always visible. _(Recommended.)_
- **B. Hub-and-spoke** — single home dashboard; two extra taps to any section; reinforces workspace context.
- **C. Hamburger / drawer** — iOS anti-pattern; not thumb-reachable with Dynamic Island.

### Workspace switcher

- **S1. Top-left avatar in the header** (iOS Mail pattern) → sheet. _(Recommended for v1.)_
- **S2. Dedicated "Workspaces" tab in the bottom bar** → full page list. (Only if user has ≥ 3 workspaces.)
- **S3. Long-press the workspace name in the header** → menu. (Not discoverable; reject.)

### Conversation mode selector (ASK / RESEARCH / ANALYZE / PLAN / EXECUTE / LEARN)

- **M1. Bottom sheet on "New conversation" tap** — 6 large radio-style rows. _(Only viable at 6 modes.)_
- **M2. Inline segmented control on the conversation list** — 6 segments at 393pt is illegible.
- **M3. Mode icon in the composer; tap to open a sheet** — mode visible inside the conversation.

### Search affordance

- **Q1. Dedicated tab** in the bottom bar (4th tab). _(Recommended if 4 tabs is acceptable.)_
- **Q2. Slide-down search bar** in the header of every page (iOS Spotlight pattern).
- **Q3. Magnifier icon in the header** → opens a sheet. _(Recommended if bottom tab is constrained to 3.)_

### Sheet vs. page vs. full-screen — when to use

- **Bottom sheet:** citation modal, workspace switcher, category picker, file picker confirmation, mode selector.
- **Full page (push):** document list, document detail, conversation list, search results, conversation detail, upload form.
- **Full-screen modal (covers nav):** approval flow (F8), destructive confirms.

---

## 4. Screen-by-screen redesign scope

| #   | Current screen                                           | Verdict                 | Justification                                                                                                                                                        |
| --- | -------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Workspace shell (PIA landing)                            | **IMPROVED**            | Add safe-area, viewport-fit, touch targets. Logic OK.                                                                                                                |
| 2   | Workspaces list (after sign-in)                          | **IMPROVED**            | Project sub-list is desktop-only; convert to card list with safe-area + thumb-reach "Open".                                                                          |
| 3   | Document list                                            | **IMPROVED**            | `<table>` does not reflow at 393pt; convert to card list at narrow viewports.                                                                                        |
| 4   | Document detail (chunks)                                 | **IMPROVED**            | "Ingestion Jobs" hard-coded empty (`document-detail.ts:120-135`); `window.confirm()` for delete (line 159) is **blocked on iOS Safari** — replace with native sheet. |
| 5   | Document upload                                          | **IMPROVED + COMBINED** | Combine "+ Upload" with a sheet triggered by FAB; keep full page as desktop fallback.                                                                                |
| 6   | Knowledge-base search                                    | **IMPROVED**            | Drop `JSON.stringify(locator)` debug string; reduce score-bar trio at narrow widths.                                                                                 |
| 7   | Conversation list (with mode selector)                   | **IMPROVED**            | `<table>` reflows to card list; `<select>` mode becomes sheet-of-options trigger.                                                                                    |
| 8   | Conversation detail (SSE, citation modal, feedback form) | **IMPROVED**            | Heaviest page (21,841 B); keep shell under documented size budget (25 KB gz target). Add "approval required" full-screen sheet for Execute mode.                     |

PWA-intent rows (parity matrix rows 9–14): all `REPLACED` or `IMPROVED` (intent) — see matrix.

BLOCKED gaps (parity matrix rows 15–16):

- **`/auth/logout`** — 404. Mobile UI **must** surface a sign-out affordance (an installed PWA that cannot be signed out is a usability failure on a shared device) but the affordance must be designed assuming the endpoint does not yet exist. Show the button; on tap, surface a polite "Sign-out is not yet available in this build" message and link to a "Sign out from the desktop app" workaround. **NOT** a redesign-scope item to implement the endpoint.
- **`/openapi.yaml`** — 404. Not surfaced in any mobile screen; out of redesign.

---

## 5. iPhone-specific priorities (ranked)

1. **Safe-area insets + Dynamic Island** — every screen must use `env(safe-area-inset-*)`.
2. **Thumb reach** — primary actions in bottom half (393×852pt; iPhone 16 Pro).
3. **Touch target size** — 44×44pt minimum (HIG); 48×48pt for primary; 56pt for Send.
4. **`viewport-fit=cover`** — required for edge-to-edge.
5. **Install-to-Home-Screen UX** — manifest, theme-color, apple-touch-icon, apple-mobile-web-app-capable, startup image. All 9 baseline paths return 404.
6. **Service worker scope** — register from `/`; coexist with `<script type="module">` blocks; CSP must be revisited.
7. **External keyboard (BT on iPhone)** — Tab traverses in DOM order; visible focus ring; `Esc` closes sheets.
8. **Offline behavior (out of scope per network-required)** — non-modal "You're offline" banner; disable destructive actions; resubmits safe (NFR-REL-002).
9. **Push (out of scope today; flag the gap)** — deferred to P7 or separate decision; not in MVP per `docs/00_PRODUCT_REQUIREMENTS.md:9`.
10. **Standalone (installed) PWA mode differences** — no URL bar, no back button, no Safari share; app must provide its own back navigation in the header; share is a future API (`navigator.share`); the app must survive full-screen relaunch. **Most material IA change.**
11. **Dark mode / system theme** — `body { color: #1a1a1a; background: #f5f5f5; }` is hard-coded (`shared.ts:10`); no `prefers-color-scheme`.
12. **Dynamic Type** — fixed `font-size: 1.5rem;` not Dynamic-Type-aware; citation modal and approval screens highest-priority.
13. **Reduce Motion** — sheet slide-up 350 ms must respect `prefers-reduced-motion`. **UNVERIFIED** in iOS 16 Pro installed PWA mode.
14. **VoiceOver / Voice Control** — Rotor landmarks, custom actions, live-region politeness tuning for SSE deltas.
15. **Reachability (one-handed)** — primary actions in bottom half; duplicate top actions in sticky bottom bar on detail pages.
16. **High-contrast / Increase Contrast** — body text passes AA at 15.3:1; **badge contrast UNVERIFIED** (`.badge-processing` ~5.5:1 — needs automated check).

---

## 6. Accessibility and cognitive-load concerns

### Top 3 cognitive-load risks

1. **6 conversation modes without discoverable descriptions.** A first-time user cannot distinguish Plan from Execute from Learn from the `<option>` text alone (`conversation-list.ts:25-30`).
2. **Retrieval result cards are information-dense.** Rank + chunk ID + version ID + source ID + JSON locator + 3 score bars per card.
3. **Streaming + concurrent state changes are not paced for mobile.** 30+ citations can stutter scroll on lower-end iPhones.

### Top 3 a11y risks

1. **Citation modal focus management on iOS Safari** — native `<dialog>` (`conversation-detail.ts:45`) is the right primitive, but iOS Safari has historical `showModal()` focus issues. **UNVERIFIED** against iOS 16 Pro.
2. **No Dynamic Type support** — fixed `rem` does not honor iOS text-size settings (WCAG 2.2 SC 1.4.4).
3. **Touch targets are not audited** — `.btn-sm` (`.3rem .7rem`, `shared.ts:33`) can fall under 44×44pt on high-density screens. No automated check exists.

### iPhone-specific a11y features to lean into

- **Dynamic Type** — `font: -apple-system-body` / `-apple-system-headline`.
- **VoiceOver rotor** — landmarks (banner, main, navigation, contentinfo) and headings. **Real WCAG 1.3.1 risk** in current pages (only `<div class="header">`, no semantic `<header>`/`<main>`).
- **Reduce Motion** — `@media (prefers-reduced-motion: reduce)`.
- **Reachability** — primary actions in bottom half.
- **Smart Invert / Classic Invert** — verify redesigned tokens don't fight Smart Invert.
- **Larger Text accessibility size (AX5)** — verify layout doesn't break.

---

## 7. Out-of-scope and product gaps (not redesign concerns)

| #   | Item                                                                                | Owner                    | When                                |
| --- | ----------------------------------------------------------------------------------- | ------------------------ | ----------------------------------- |
| 1   | `/auth/logout` not implemented (404)                                                | PIA team / API owner     | TBD — flag in P4 pre-flight backlog |
| 2   | `/openapi.yaml` not served at runtime (404)                                         | PIA team / API owner     | TBD                                 |
| 3   | AUD-P3-002: 5 `as unknown as` casts in production                                   | PIA team (P4)            | P4                                  |
| 4   | AUD-P3-003: `db/schema.sql` drift vs 10 migrations                                  | PIA team (P4)            | P4                                  |
| 5   | AUD-P3-101: feedback cross-tenant insert gap                                        | PIA team (P4 pre-flight) | P4-T01                              |
| 6   | AUD-P3-102: orchestrator provider-error sanitization                                | PIA team (P4 pre-flight) | P4-T01                              |
| 7   | AUD-P3-103: test/e2e and test/security eslint parser                                | PIA team                 | Optional                            |
| 8   | AUD-P3-104: dev-only dependency advisories                                          | PIA team                 | Track                               |
| 9   | AUD-P3-105: app build stubs (`echo`)                                                | PIA team                 | P7                                  |
| 10  | AUD-P3-106: file-scanning stub                                                      | PIA team                 | P7                                  |
| 11  | AUD-P3-107: MANIFEST tracked-file count lag (now 522)                               | `@repository-docs`       | Low-risk                            |
| 12  | Conversation detail `loadMessages` is a no-op stub (`conversation-detail.ts:55-61`) | PIA team / API owner     | TBD                                 |
| 13  | Document detail "Ingestion Jobs" hard-coded empty                                   | PIA team / API owner     | TBD                                 |
| 14  | `search.ts:131` `JSON.stringify(locator)` debug string                              | Design contract fix      | Inside redesign                     |
| 15  | `document-detail.ts:159` `window.confirm()` for delete                              | Design contract fix      | Inside redesign                     |
| 16  | `AGENT_HANDOFF.md:26` mislabels `@pia/web` as Next.js                               | `@repository-docs` (B-5) | Low-risk                            |
| 17  | `opencode.json` vs `opencode.jsonc` ambiguity                                       | ADR owner (B-4)          | Separate decision                   |

The product model **does not authorize** work on items 1–13 and 16–17. Items 14–15 are in-scope for the design contract because the redesign will touch them anyway.

---

## 8. Open blockers — relevance to product-model decision

| Blocker | Title                                                | Blocks product model?                                 | Blocks downstream?                        |
| ------- | ---------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------- |
| **B-1** | Physical iPhone 16 Pro availability UNCONFIRMED      | **No** — design-decision work from captured evidence. | **Yes** — `device-validation` phase.      |
| **B-2** | `mobile-ui-design-contract` command missing          | **No** — orchestrator can dispatch directly.          | Workflow gap at `design-contract` phase.  |
| **B-3** | `.opencode/run-logs/cookies.txt` real session cookie | **No** — mitigated via `.gitignore`.                  | **No**.                                   |
| **B-4** | `opencode.json` vs `opencode.jsonc` ambiguity        | **No** — out of product-model scope.                  | ADR.                                      |
| **B-5** | `AGENT_HANDOFF.md` mislabels `@pia/web` as Next.js   | **No** — low-risk docs.                               | Low-risk.                                 |
| **B-6** | Playwright + axe-core dependency-approval policy     | **No** — affects G7.                                  | **Yes** — automated a11y/visual evidence. |

**Net for the product model:** none of B-1 through B-6 block this gate.

---

## 9. Trade-offs (T1–T7) — user must choose

| #   | Trade-off                                    | Options                                                                                                                                             | Recommendation                                |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| T1  | Primary navigation pattern                   | A. Bottom tab bar (3–4 tabs); B. Hub-and-spoke; C. Hamburger                                                                                        | **A**                                         |
| T2  | Conversation detail layout                   | A. Single-pane with bottom-sheet citation modal; B. Split view iPad / sheet iPhone; C. Card-stack                                                   | **A**                                         |
| T3  | Search placement                             | A. Dedicated bottom tab; B. Magnifier in header (opens sheet); C. Slide-down search bar (Spotlight)                                                 | **A** if 4 tabs OK; **B** if constrained to 3 |
| T4  | Workspace switcher placement                 | A. Top-left avatar in header (iOS Mail); B. Dedicated "Workspaces" tab; C. Long-press workspace name (not discoverable)                             | **A**                                         |
| T5  | Voice / text mode for input                  | A. Text only (iOS dictation as system-level); B. Dictation-first with mic button; C. Multimodal (deferred)                                          | **A**                                         |
| T6  | Network-loss behavior (network-required PWA) | A. Persistent top banner + disable destructive actions; B. Cached last-screen read-only (rejected); C. Graceful redirect to `/v1/health` (rejected) | **A**                                         |
| T7  | + Upload / New conversation trigger          | A. FAB on Documents / Conversations tabs; B. Center tab as "+" (fights HIG); C. Inline header button (thumb-stretches)                              | **A**                                         |

---

## 10. Acceptance criteria for the product-model gate (PIA-MUR-D-002)

The product model is approved when **all** of the following are true:

- **A1.** A ranked list of 5–8 target user outcomes is on record (Section 1) and the user has confirmed the priority order, with explicit acknowledgement of any outcome that is **deferred** for v1.
- **A2.** A ranked list of 3–8 critical user flows is on record (Section 2) and the user has confirmed the ranking, with explicit acknowledgement of any flow that is **deferred** (notably F8 — approvals — which is rare in MVP).
- **A3.** A documented set of 2–3 IA alternatives is on record for primary navigation, workspace switcher, mode selector, and search placement (Section 3 + Section 9 trade-offs T1, T3, T4), and the user has expressed a preference (or explicitly accepted "no preference — design contract to recommend").
- **A4.** A screen-by-screen disposition table is on record (Section 4) and the user has confirmed the verdict for each of the 8 current screens, including any screen marked `COMBINED`, `REMOVED_WITH_APPROVAL`, or `BLOCKED`. The 2 `BLOCKED` gaps (`/auth/logout`, `/openapi.yaml`) are explicitly re-listed as out-of-scope and assigned an owner.
- **A5.** The iPhone-specific priority list (Section 5) is on record, with the user confirming the top-3 priorities (safe-area/Dynamic Island, thumb reach, 44pt+ targets) and acknowledging the deferred items (push, Back Tap, Reachability duplicate-bottom-bar). UNVERIFIED claims (e.g., iOS Safari `prefers-reduced-motion` in installed PWA mode) are flagged for the device-validation phase.
- **A6.** The top-3 cognitive-load risks and top-3 a11y risks are on record (Section 6), with at least one risk per category addressed by a follow-up design-contract task. The `<dialog>` focus-management claim is **UNVERIFIED** against iOS 16 Pro and is flagged for the device-validation phase.
- **A7.** A documented set of out-of-scope items is on record (Section 7), each assigned an owner and a phase/roadmap slot. Items 14 and 15 (`JSON.stringify(locator)`, `window.confirm()`) are confirmed as in-scope for the design contract.
- **A8.** All 6 blockers (B-1 through B-6) are listed with a "blocks product model: yes/no" decision (Section 8), and the user acknowledges that B-1 (physical iPhone) blocks the downstream `device-validation` phase but not this gate.
- **A9.** This product-model report is added to `.ui-redesign/reports/PIA-MUR-D-002-product-model.md` and referenced from `.ui-redesign/state/workflow-state.json` and `.ui-redesign/decisions/DECISION_LEDGER.md`.
- **A10.** The orchestrator's PIA-MUR-D-002 decision packet includes the recommended verdicts for T1, T2, T3, T4, T5, T6, T7 (Section 9) as a separate "trade-off preferences" sub-section, with the option for the user to "accept all defaults" or pick per item.

---

## Appendix: Source-of-evidence index

- `.ui-redesign/adapter/REPOSITORY_ADAPTER.md` (PIA-MUR-ADAPTER-001, APPROVED) — product purpose, primary user classes, critical outcomes, network/PWA intent, protected areas, git policy, device matrix.
- `.ui-redesign/baseline/REPOSITORY_BASELINE.md` (PIA-MUR-D-001) — runtime evidence, PWA and mobile evidence, security headers, source-code baseline, P3-GATE inheritance, open gaps, blocker status.
- `.ui-redesign/contracts/FEATURE_PARITY_MATRIX.md` — 16 rows.
- `.ui-redesign/evidence/automated/http-baseline-probes.json` — public routes, workspace routes, API routes, auth routes, PWA assets (all 404), HTML evidence, security headers.
- `docs/00_PRODUCT_REQUIREMENTS.md` — personas, product modes, J-001..J-005, NFRs.
- `docs/01_SYSTEM_REQUIREMENTS.md` — NFR-PERF, NFR-UX, FR-CIT, FR-FBK, FR-TOOL.
- `apps/web/src/pages/shared.ts:8-66, 126-192` — `sharedCss` inline; `pageShell` viewport meta.
- `apps/web/src/pages/document-list.ts:22-34` — `<table>` layout.
- `apps/web/src/pages/document-detail.ts:158-170` — `window.confirm()` for delete.
- `apps/web/src/pages/search.ts:131` — `JSON.stringify(locator)` debug string.
- `apps/web/src/pages/conversation-list.ts:24-30, 36-48` — 6-mode `<select>` + `<table>` list.
- `apps/web/src/pages/conversation-detail.ts:25-46, 81-98, 270-303` — thread, feedback, SSE.
- `apps/web/src/pages/conversation-shared.ts:153-191, 302-328` — run-state, feedback, citation modal.
- `apps/web/test/a11y-static.test.ts:1-156` — static a11y checks.
- `packages/contracts/src/index.ts` — `ConversationMode`, `ModelRunStatusApi`, `FeedbackCategory`.
- `api/openapi.yaml` — 37 operations.
- `AGENT_HANDOFF.md:130-137, 171-222` — AUD-P3-002, 003, 101–107 carried forward.
- `planning/runs/P3-GATE.md:42-56` — inherited P3-GATE baseline.

---

**UNVERIFIED items (orchestrator to confirm or flag for device-validation):**

- iOS 16 Pro Safari focus-management behavior of native `<dialog>` `showModal()`.
- `prefers-reduced-motion` media-query support in iOS 16 Pro installed PWA mode.
- Color-contrast ratios of badge classes in the current CSS (estimated by inspection; needs an automated axe-core check).
- Physical iPhone 16 Pro availability and reachability to the chosen bridge (B-1, blocking device-validation only).
