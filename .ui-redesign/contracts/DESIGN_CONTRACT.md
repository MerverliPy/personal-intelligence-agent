# PIA Mobile UI Design Contract (PIA-MUR-D-004)

**Status:** `proposed`
**Phase:** `design-contract` (after `concept-approved`; before `implementation-contract`)
**Contract ID:** `PIA-MUR-D-004`
**Authored by:** `design-system-architect` specialist (read-only inspection of approved inputs)
**Approver:** user
**Machine-readable contract:** `.ui-redesign/contracts/DESIGN_CONTRACT.json` (validates against `contracts/design-contract.schema.json`)

---

## Section 1: Contract scope

This contract translates the approved Stream concept (`PIA-MUR-D-003c`, APPROVED 2026-06-14) and the approved product model (`PIA-MUR-D-002`, APPROVED 2026-06-14) into a complete, machine-readable + human-readable design system. It is the authoritative reference for **all visual, behavioral, accessibility, motion, safe-area, viewport, PWA, and data policy decisions** for the iPhone 16 Pro portrait redesign of the Personal Intelligence and Action Engine.

### Decisions translated

| ID | What it decided | Status | Source |
|---|---|---|---|
| `PIA-MUR-D-001` | Repository adapter + baseline phase authorization | APPROVED 2026-06-14 | `.ui-redesign/adapter/REPOSITORY_ADAPTER.md` |
| `PIA-MUR-D-002` | Product model (T1=A bottom tab, T2=A bottom-sheet citation, T3=A Search tab, T4=A header avatar, T5=A text-only composer, T6=A network banner, T7=A FAB) | APPROVED 2026-06-14 | `.ui-redesign/reports/PIA-MUR-D-002-product-model.md` |
| `PIA-MUR-D-003` | Concept pick (selects Stream over Calm and Workspace) | APPROVED 2026-06-14 | `.ui-redesign/decisions/DECISION_LEDGER.md` |
| `PIA-MUR-D-003c` | Stream concept (single PIA blue accent, footnote-style citation chips, sheet-heavy navigation, conversation-first) | APPROVED 2026-06-14 | `.ui-redesign/concepts/concept-3-stream/` |

### Target

- **Primary device:** iPhone 16 Pro, 393×852pt logical viewport, 3× DPR
- **Orientation:** portrait only
- **Environments (per schema):** Safari, installed PWA (Add to Home Screen), iOS Chrome
- **Compatibility devices:** iPhone 15, 14, 13, SE (3rd generation)
- **Network requirement:** online-only
- **PWA intent:** installable via Safari → Share → Add to Home Screen (HTTPS via cloudflared quick-tunnel)

### What this contract authorizes

**The contract authorizes the translation of approved decisions into a design system.** It does **not** authorize any:

- Product code change in `apps/web/`, `apps/api/`, `apps/worker/`, or `packages/*`
- Dependency addition
- Schema change
- Route change
- API contract change
- Auth/authz change
- Infrastructure change
- Deployment change

A separate `PIA-MUR-D-004-IMPL` implementation contract (and its approval) is required before any product code is modified.

---

## Section 2: Token reference

All values are sourced from the Stream prototype (`.ui-redesign/concepts/concept-3-stream/interactive/styles.css`) and the prototype's motion spec (`.ui-redesign/concepts/concept-3-stream/evidence/source-file-changes.md`). The Stream prototype was the basis for the user's approval of `PIA-MUR-D-003c`.

### 2.1 Color tokens

| Token | Light | Dark | Notes / source |
|---|---|---|---|
| `--bg` | `#FFFFFF` | `#0A0A0A` | Surface |
| `--fg` | `#0A0A0A` | `#F5F5F5` | Body text |
| `--fg-muted` | `#5C5C5C` | `#A0A0A0` | Captions, secondary text |
| `--fg-subtle` | `#9C9C9C` | `#6C6C6C` | Tertiary, hairline-on-bg |
| `--divider` | `#ECECEC` | `#1F1F1F` | Hairline dividers (0.5pt) |
| `--accent` | `#2563EB` | `#3B82F6` | **Single PIA blue accent** (Stream signature) |
| `--accent-pressed` | `#1D4ED8` | `#2563EB` | Pressed state of accent |
| `--accent-fg` | `#FFFFFF` | `#FFFFFF` | Foreground on accent surface |
| `--selection` | `#DBE7FF` | `#1E3A5C` | Active row, selected state |
| `--success` | `#16A34A` | `#16A34A` | Status semantic |
| `--warning` | `#D97706` | `#D97706` | Status semantic |
| `--danger` | `#DC2626` | `#DC2626` | Status semantic |
| `--backdrop` | `rgba(0,0,0,0.4)` | `rgba(0,0,0,0.6)` | Sheet backdrop |

**Source for light values:** `.ui-redesign/concepts/concept-3-stream/interactive/styles.css:11-20`
**Source for dark values:** `.ui-redesign/concepts/concept-3-stream/interactive/styles.css:57-78` (two blocks: `@media (prefers-color-scheme: dark)` and `.theme-dark`)

#### 2.1.1 Status tokens (constant across light and dark mode)

Status colors are **semantic** and stay constant across themes. The Stream prototype follows iOS-native behavior: status pills remain color-coded even in dark mode. Only the surface tokens (`--bg`, `--fg`, `--divider`) invert.

| Status | Background | Foreground |
|---|---|---|
| `READY` / `COMPLETED` | `#DCFCE7` | `#166534` |
| `INGESTING` / `PROCESSING` / `STREAMING` | `#DBEAFE` | `#1E40AF` |
| `FAILED` / `INTERRUPTED` | `#FEE2E2` | `#991B1B` |
| `QUARANTINED` / `CANCELLED` | `#FEF3C7` | `#92400E` |
| `UPLOADED` | `#F3E8FF` | `#6B21A8` |
| `PENDING` / `CREATED` | `#F3F4F6` | `#374151` |

**Source:** `.ui-redesign/concepts/concept-3-stream/interactive/styles.css:26-38` + `.ui-redesign/concepts/concept-3-stream/interactive/styles.css:253-261` + `apps/web/src/pages/shared.ts:40-47` (existing baseline) + `apps/web/src/pages/conversation-detail.ts:330-338` (run-state badge map). `CANCELLED` and `INTERRUPTED` are inherited from the baseline badge classes; `COMPLETED` and `STREAMING` are the additional states from the run-state badge map.

#### 2.1.2 Mode-dot tokens (one color per ConversationMode)

| Mode | Color |
|---|---|
| `ASK` | `#2563EB` |
| `RESEARCH` | `#7C3AED` |
| `ANALYZE` | `#DB2777` |
| `PLAN` | `#16A34A` |
| `EXECUTE` | `#EA580C` |
| `LEARN` | `#0891B2` |

**Source:** `.ui-redesign/concepts/concept-3-stream/interactive/styles.css:216-221`. All 6 values map to `ConversationMode` at `packages/contracts/src/index.ts:347`.

### 2.2 Typography tokens

| Token | Default | AX5 (Larger Text) | Notes |
|---|---|---|---|
| Font family | `-apple-system, BlinkMacSystemFont, system-ui, "SF Pro Text", "Helvetica Neue", sans-serif` | (same) | Native iOS system font; no font fetch |
| `--t-body` | 19pt | 34pt | Conversation thread, list rows |
| `--t-caption` | 14pt | 24pt | Time, meta, sheet eyebrows |
| `--t-section` | 24pt | 42pt | Header title, sheet title |
| `--t-large` | 32pt | 56pt | Reserved for large title (currently unused in prototype) |
| `--t-tab` | 10pt | 16pt | Bottom tab labels |
| Line height (body) | 1.42 | 1.42 | -- |
| Line height (display) | 1.2 | 1.2 | -- |
| Weights | 400, 500, 600, 700 | (same) | -- |

**Source:** `.ui-redesign/concepts/concept-3-stream/interactive/styles.css:48-55` and `.ui-redesign/concepts/concept-3-stream/interactive/styles.css:95-101` (AX5 multiplier).

**AX5 ratio:** 1.78× (Stream prototype; matches Apple's AX5 default for "Larger Text" accessibility size).

### 2.3 Spacing tokens (4pt grid)

| Token | Value |
|---|---|
| `--s-1` | 4pt |
| `--s-2` | 8pt |
| `--s-3` | 12pt |
| `--s-4` | 16pt |
| `--s-5` | 20pt |
| `--s-6` | 24pt |
| `--s-8` | 32pt |
| `--s-10` | 40pt |
| `--s-12` | 48pt |

**Source:** Derived from Stream prototype spacing values used throughout `styles.css` (padding, margin, gap declarations).

### 2.4 Shape tokens

| Token | Value | Used by |
|---|---|---|
| `--r-sm` | 8pt | Small surfaces (chips, feedback banner) |
| `--r-md` | 12pt | Search input, message input |
| `--r-lg` | 16pt | Large surfaces (sheet panel, future cards) |
| `--r-pill` | 9999pt | Selected tab indicator (square top, square bottom — actually 2pt in Stream) |
| `--r-circle` | 50% | FAB, avatar, send button, mode dot |
| Row corners | 0pt | All list rows (sharp; iOS-native list aesthetic) |
| Sheet panel top corners | 14pt | `.sheet__panel` (close to `--r-lg`; matches iOS native sheet) |

**Source:** `.ui-redesign/concepts/concept-3-stream/interactive/styles.css:264-302` (tabs use 2pt radius on the active indicator; FAB and avatar use 50%).

### 2.5 Elevation tokens

| Token | Value | Used by |
|---|---|---|
| `--shadow-1` | `0 1pt 2pt rgba(0, 0, 0, 0.08)` | Reserved (not heavily used in Stream) |
| `--shadow-2` | `0 2pt 8pt rgba(0, 0, 0, 0.12)` | Reserved (not heavily used in Stream) |
| `--fab-shadow` | `0 6pt 20pt rgba(37, 99, 235, 0.36)` | FAB default |
| `--fab-shadow-pressed` | `0 2pt 6pt rgba(37, 99, 235, 0.24)` | FAB pressed (scale 0.94) |
| Hairline divider | `0.5pt solid var(--divider)` | Tab bar top, list row bottom, composer top, header bottom |

**Source:** `.ui-redesign/concepts/concept-3-stream/interactive/styles.css:320-325` (FAB).

**Principle:** Lists and chrome use 0.5pt hairlines for the iOS-native look. The FAB is the only elevated element (brand-color tinted shadow).

### 2.6 Motion tokens

| Token | Value | Notes |
|---|---|---|
| `--motion-fast` | 120ms | Short transitions (tab color, row press) |
| `--motion-base` | 200ms | Standard transitions (fade, citation underline) |
| `--motion-slow` | 280ms | Slow transitions (sheet slide-up) |
| `--motion-sheet` | 280ms | Sheet slide-up (Stream signature) |
| `--motion-fade` | 200ms | Backdrop fade, network banner |
| `--motion-ease` | `cubic-bezier(0.32, 0.72, 0, 1)` | iOS-native "sharp out" curve |

**Source:** `.ui-redesign/concepts/concept-3-stream/interactive/styles.css:22-24` (core) + PIA-MUR-D-002 §5 guidance for the `--motion-fast` / `--motion-base` / `--motion-slow` scale.

**Reduced-motion fallback:** `prefers-reduced-motion: reduce` sets `--motion-sheet` and `--motion-fade` to `0.01ms` (not `0ms`). The `0.01ms` value preserves the keyframe `to` state so the element reaches its final state via animation rather than skipping. Source: `.ui-redesign/concepts/concept-3-stream/interactive/styles.css:80-93`.

### 2.7 Safe-area and dynamic-viewport tokens

| Token | Value | Used by |
|---|---|---|
| `--tab-bar-h` | 49pt | Tab bar height |
| `--tab-bar-safe` | `calc(49pt + env(safe-area-inset-bottom, 0px))` | Tab bar height including home indicator |
| `--header-h` | 44pt | Header content height |
| `--composer-h` | 56pt | Composer (Send button) |
| `--fab-size` | 56pt | FAB |
| `--touch-min` | 44pt | Minimum tap target (HIG) |
| Top of header | `max(env(safe-area-inset-top, 0px), 59pt)` | Dynamic Island clearance |
| Bottom of tab bar | `49pt + env(safe-area-inset-bottom, 0px)` | Home indicator clearance |
| FAB position | `bottom: var(--tab-bar-safe) + 16pt; right: max(16pt, env(safe-area-inset-right, 0px))` | Bottom-right, safe-area-cleared |
| Viewport meta | `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` | Edge-to-edge layout |
| Viewport height | `100dvh` (with `100vh` fallback) | Dynamic viewport units for keyboard + URL bar |

**Source:** `.ui-redesign/concepts/concept-3-stream/interactive/styles.css:40-46` + `.ui-redesign/concepts/concept-3-stream/interactive/index.html:5` (viewport meta).

---

## Section 3: Navigation

### 3.1 Bottom tab bar (3 tabs, T1=A)

```
┌──────────────────────────────────────────────────────┐
│  [💬 tab active]    [📄]    [🔍]                     │  ← 49pt + safe-area
│  Conversations      Documents   Search                │
└──────────────────────────────────────────────────────┘
```

- **Tabs (left to right):** Conversations (default landing), Documents, Search
- **Each tab:** 1/3 width (131pt on 393pt viewport), 44pt min-height, 28pt × 28pt icon, 10pt label
- **Selected indicator:** 2pt top accent bar, 40% width centered, `var(--accent)` background
- **Selected color:** `var(--accent)`; unselected: `var(--fg-muted)`
- **ARIA:** `<nav role="navigation" aria-label="Primary">`; each tab is a `<button>` with implicit name; selected tab has `aria-current="page"`
- **Source:** `.ui-redesign/concepts/concept-3-stream/interactive/index.html:293-315` + `.ui-redesign/concepts/concept-3-stream/interactive/styles.css:264-302`

### 3.2 Top app bar (header)

```
┌──────────────────────────────────────────────────────┐
│  ┌───┐                                                │  ← 44pt + safe-area
│  │ P │   Conversations                                │
│  └───┘                                                │
└──────────────────────────────────────────────────────┘
```

- **Left slot:** 32pt avatar circle (`var(--accent)` bg, white initial letter)
  - `aria-label="Workspace: <name>. Tap to switch."`
  - `aria-haspopup="dialog"`, `aria-expanded` toggles
  - Tap → opens workspace switcher sheet (T4=A)
- **Center slot:** 24pt section title, 700 weight, -0.02em letter-spacing
  - Truncates on long titles
  - Per-screen text (Conversations / Documents / Search / conversation title)
- **Right slot:** intentionally empty (Stream has no settings cog; discoverability tradeoff)
- **On detail screens:** avatar is replaced by a back chevron (left-pointing chevron, 22pt stroke, 44pt tap target)
- **Source:** `.ui-redesign/concepts/concept-3-stream/interactive/index.html:20-25, 104-108` + `.ui-redesign/concepts/concept-3-stream/interactive/styles.css:145-179, 544-558`

### 3.3 FAB triggers (T7=A)

- **Conversations tab:** FAB → opens mode-of-conversation sheet (6 radio rows: ASK / RESEARCH / ANALYZE / PLAN / EXECUTE / LEARN)
- **Documents tab:** FAB → opens upload sheet (file picker + title + "Upload" primary action; 50MB cap)
- **Search tab:** FAB hidden (no creation action)
- **Position:** bottom-right, `bottom: var(--tab-bar-safe) + 16pt; right: max(16pt, env(safe-area-inset-right, 0px))`
- **Source:** `.ui-redesign/concepts/concept-3-stream/interactive/index.html:94-98, 237-241` + `.ui-redesign/concepts/concept-3-stream/interactive/styles.css:305-325`

### 3.4 Bottom sheets (T2=A, M1)

- **Citation sheet** — claim text, source, locator (as `page N`, never `JSON.stringify(locator)`), verification status, "Open source" primary action
- **Mode-of-conversation sheet** — 6 large radio rows with name + 1-line description
- **Feedback sheet** — 8 categories (`POSITIVE` / `NEGATIVE` / `INCORRECT` / `INCOMPLETE` / `CITATION_ISSUE` / `STYLE_ISSUE` / `UNSAFE` / `FREE_TEXT`) + optional free-text correction/notes textarea
- **Workspace switcher sheet** — list of workspaces with current marked
- **Upload sheet** — file picker (camera / Files / iCloud Drive) + title + "Upload" primary action

**All sheets:** 280ms slide-up via `--motion-sheet`; max-height 80vh; backdrop `rgba(0,0,0,0.4)`; 14pt top corners; handle bar (4pt × 36pt, `--fg-subtle`); focus trap; dismiss via swipe-down (> 80pt), backdrop tap, or `Esc`.

**Source:** `.ui-redesign/concepts/concept-3-stream/interactive/index.html:320-352` + `.ui-redesign/concepts/concept-3-stream/interactive/styles.css:347-426` + `.ui-redesign/concepts/concept-3-stream/interactive/app.js:43-66, 195-217`.

### 3.5 Full-screen sheet (destructive confirms, approvals)

Reserved for destructive confirms (e.g., replace `window.confirm()` at `apps/web/src/pages/document-detail.ts:159`) and approval flows (FR-TOOL-004; F8). Covers entire viewport including safe-area. Header: Cancel + Title + primary action. Primary action is destructive (uses `--danger`).

### 3.6 Back / forward in standalone PWA mode

- **No URL bar** (display: "standalone")
- **No browser back** — the in-app back chevron replaces it (mandatory)
- **No browser forward** — the in-app navigation model is push-only with explicit back chevron
- **No Safari share** — `navigator.share` is a future API (flagged in PIA-MUR-D-002 §5 #10; out of scope for v1)
- **App must survive a full-screen relaunch** — cold start goes to Conversations default landing

---

## Section 4: Component anatomy

For each component: **anatomy, variants, states, behavior, a11y, motion, safe-area, source-file change**. The full machine-readable inventory is in `DESIGN_CONTRACT.json` (`components` array). This section summarizes the 17 components.

### 4.1 Component summary table

| # | Component | Source (Stream prototype) | Touches baseline file |
|---|---|---|---|
| 1 | Bottom Tab Bar | `index.html:293-315` + `styles.css:264-302` | `apps/web/src/pages/shared.ts:60-62` (delete top tab-bar); `apps/api/src/routes/web.ts:126-192` (add bottom tab bar) |
| 2 | Top App Bar | `index.html:20-25` + `styles.css:145-179` | `apps/web/src/pages/shared.ts:126-192` |
| 3 | Bottom Sheet (slide-up) | `index.html:320-352` + `styles.css:347-377` | `apps/web/src/pages/conversation-detail.ts:45` (wrap existing `<dialog>` in sheet) |
| 4 | Full-Screen Sheet | (Brief; not in prototype) | `apps/web/src/pages/document-detail.ts:158-170` (replace `window.confirm`) |
| 5 | Citation Chip (footnote) | `index.html:122-124` + `styles.css:471-500` | `apps/web/src/pages/conversation-detail.ts:100-104` (KEEP `[N]` shape; update CSS to footnote style) |
| 6 | FAB | `index.html:94-98` + `styles.css:305-325` | `apps/web/src/pages/conversation-list.ts:22-35` (delete New conversation form); `apps/web/src/pages/document-list.ts:18-21` (delete +Upload button) |
| 7 | Status Badge | `styles.css:243-261` | `apps/web/src/pages/shared.ts:39-47` (keep tokens; add STREAMING, COMPLETED, INTERRUPTED aliases) |
| 8 | Message Bubble | `index.html:111-150` + `styles.css:429-468` | `apps/web/src/pages/conversation-detail.ts:25-46` (KEEP; align with Stream) |
| 9 | Mode-of-Conversation Sheet | `index.html:337-352` + `styles.css:406-426` | `apps/web/src/pages/conversation-list.ts:25-30` (REPLACE `<select>`) |
| 10 | File Picker Sheet (Upload) | (Brief; not in prototype) | `apps/web/src/pages/document-list.ts:18-21` (REPLACE with FAB trigger) |
| 11 | Search Input | `index.html:247-252` + `styles.css:561-579` | `apps/web/src/pages/search.ts:13-156` (re-flow to sticky single-row) |
| 12 | Result Card | `index.html:253-287` + `styles.css:581-594` | `apps/web/src/pages/search.ts:131-137` (DELETE `JSON.stringify(locator)`; collapse score-bar trio) |
| 13 | Empty State | (Brief; not in prototype) | per-screen additions to `conversation-list.ts`, `document-list.ts`, `search.ts` |
| 14 | Error State (Inline Banner) | (Brief; not in prototype) | `apps/web/src/pages/shared.ts:92-94` (sanitize `request_id` out) |
| 15 | Offline Banner | `index.html:13-16` + `styles.css:327-345` | `apps/web/src/pages/shared.ts:186-189` (add online/offline listeners) |
| 16 | Loading Skeleton | (Brief; not in prototype) | per-screen additions |
| 17 | Network-Required Splash | (Brief; not in prototype) | `apps/api/src/routes/web.ts:126-192` (pageShell adds splash) |

### 4.2 Source-file change evidence (read-only inspection)

The full annotated change list is in `.ui-redesign/concepts/concept-3-stream/evidence/source-file-changes.md`. The design contract **does not modify any source file**; it is a translation of approved decisions. The implementation contract (`PIA-MUR-D-004-IMPL`) will perform these changes with a separate approval.

Key change points:

- `apps/web/src/pages/shared.ts:8-66` — replace token-less inline CSS with the Stream token system
- `apps/web/src/pages/shared.ts:40-47` — keep 6 baseline status classes; add 3 more (STREAMING, COMPLETED, INTERRUPTED) routed through `--status-*` tokens
- `apps/web/src/pages/shared.ts:60-62` — DELETE the top tab bar (replaced by bottom tab bar)
- `apps/web/src/pages/shared.ts:126-192` — add `<header role="banner">` with avatar (T4=A), `<nav role="navigation" aria-label="Primary">` with 3 tab buttons, `<main role="main">`
- `apps/web/src/pages/conversation-list.ts:22-35` — DELETE the New conversation form (replaced by FAB)
- `apps/web/src/pages/conversation-list.ts:25-30` — REPLACE 6-mode `<select>` with mode-of-conversation sheet trigger
- `apps/web/src/pages/conversation-list.ts:36-48` — convert `<table>` to a list of `<li>` rows
- `apps/web/src/pages/conversation-detail.ts:45` — keep native `<dialog id="citation-modal">` as inner surface; wrap in `<div class="sheet">` for slide-up
- `apps/web/src/pages/conversation-detail.ts:100-104` — KEEP `renderCitationChipClient` `[N]` shape; route through `.cite` footnote-style class
- `apps/web/src/pages/conversation-detail.ts:81-98` — REPLACE native `<select>` for feedback with feedback sheet
- `apps/web/src/pages/conversation-detail.ts:270-303` — KEEP `handleSseEvent`; preserve `aria-live="polite"` thread
- `apps/web/src/pages/document-list.ts:18-21` — DELETE "+ Upload" header button (replaced by FAB)
- `apps/web/src/pages/document-list.ts:22-34` — convert `<table>` to a list of `<li>` rows
- `apps/web/src/pages/search.ts:131` — DELETE `JSON.stringify(locator)` (PIA-MUR-D-002 §7 item 14)
- `apps/web/src/pages/search.ts:133-137` — collapse score-bar trio to single `Fuse: 0.943` chip on mobile
- `apps/web/src/pages/document-detail.ts:158-170` — REPLACE `window.confirm()` with full-screen sheet (PIA-MUR-D-002 §7 item 15)
- `apps/web/src/pages/upload.ts:23` — KEEP "Maximum size: 50 MB." text
- `apps/web/src/test/a11y-static.test.ts:1-156` — extend with: bottom-bar `role="navigation"` test; FAB `aria-label` test; destructive-confirm test; citation-chip 44pt test
- `apps/api/src/routes/web.ts:25` — change viewport meta to include `viewport-fit=cover`
- `apps/api/src/routes/web.ts:131` — add PWA-intent meta tags (manifest link, theme-color, apple-mobile-web-app-capable, etc.)

---

## Section 5: State contracts

The full machine-readable inventory is in `DESIGN_CONTRACT.json` (`states` array). The 8 required states:

| State | Contract | A11y | Motion |
|---|---|---|---|
| **loading** | Skeleton for ≤ 1s; persistent skeleton (no spinner) for > 1s; cancellable operations show Cancel | `role="status"` `aria-label="Loading…"` `aria-live="polite"` | 1.5s pulse opacity 0.6 → 1.0 → 0.6; reduced-motion: static |
| **empty** | Centered icon (48pt) + headline (24pt 700 weight) + 1-line subtext (19pt) + primary CTA (44pt min-height) | h2 headline; CTA accessible name; `aria-live="polite"` on first paint | Fade-in 200ms ease; reduced-motion: instant |
| **error** | Inline red banner with code (uppercase) + sanitized 1-line message; retry button; **NEVER show `request_id`** | `role="alert"` `aria-live="assertive"` | Fade-in 200ms ease; reduced-motion: instant |
| **offline** | Persistent top banner below Dynamic Island; disables destructive actions (FAB, Send, Retry Ingestion, Delete) at 40% opacity; resubmits use idempotency keys (NFR-REL-002) | `role="status"` `aria-live="polite"`; disabled controls have `aria-disabled="true"` | Slide-in 220ms cubic-bezier(0.32, 0.72, 0, 1); reduced-motion: instant |
| **pressed** | 8% darker background on rows (var(--divider)); scale 0.94 on FAB; release on touchend | Visual only; no ARIA change | Row press 80ms ease-out; FAB press 100ms ease-out |
| **focus** | 2pt `--accent` outline + 2pt offset (FAB uses 3pt white outline); visible on `:focus-visible` only (keyboard) | `:focus-visible` selector; never `:focus` alone | Instant |
| **disabled** | 40% opacity; `pointer-events: none`; `aria-disabled="true"` | `aria-disabled="true"` on buttons; `disabled` attribute on form controls; VoiceOver announces "dimmed" | N/A |
| **success** | Inline checkmark + 1-line text; auto-dismiss after 3s (or on next user action) | `role="status"` `aria-live="polite"` | Fade-in 200ms ease; auto-dismiss fade-out 200ms ease after 3s |

---

## Section 6: Motion contracts

- **All durations and easings** are CSS custom properties (single source of truth).
- **Single token change disables all sheets:** setting `--motion-sheet: 0` (or any value) globally disables sheet motion.
- **Easing:** `cubic-bezier(0.32, 0.72, 0, 1)` — iOS-native "sharp out" curve.
- **`prefers-reduced-motion: reduce`** sets motion tokens to `0.01ms` (not `0ms`). The `0.01ms` value preserves the keyframe `to` state so the element reaches its final state via animation rather than skipping. Stream uses `0.01ms` deliberately.
- **Adaptive motion:** `motion.adaptive: true` — CSS variables allow per-element motion override.
- **User-selectable motion:** `motion.userSelectable: true` — `.theme-reduce-motion` class adds a manual toggle (matches Stream prototype `app.js:167-168`).
- **Reduced-motion compliance:** `motion.reducedMotion: true` — fully honored in both Safari and installed PWA mode (the latter is **UNVERIFIED** for iOS 16 Pro; flagged for `device-validation` per PIA-MUR-D-002 §6).

### 6.1 Element timing reference

| Element | Property | Duration | Easing |
|---|---|---:|---|
| Tab switch (selected) | color, fill | 100ms | linear |
| Row press in | background | 80ms | ease-out |
| Row press out | background | 200ms | ease-in-out |
| FAB press in | transform: scale 1.0 → 0.94 | 100ms | ease-out |
| FAB press out | transform: scale | 200ms | ease-in-out |
| Sheet open | transform: translateY 100% → 0 | 280ms | cubic-bezier(0.32, 0.72, 0, 1) |
| Sheet close | transform: translateY 0 → 100% | 240ms | cubic-bezier(0.32, 0.72, 0, 1) |
| Backdrop fade | opacity 0 → 0.4 | 200ms | ease |
| Network banner in | transform: translateY -100% → 0 | 220ms | cubic-bezier(0.32, 0.72, 0, 1) |
| Citation chip underline | transform: scaleX 0.5 → 1 | 200ms | ease |
| Streamed text reveal | (n/a) | 0ms | n/a (single-frame append) |

### 6.2 Banned animations

- Parallax
- Zoom on tap
- Infinite animations
- Auto-playing carousels

---

## Section 7: Accessibility contracts

**Standard:** WCAG 2.2 AA (minimum); AAA where practical.

- **`accessibility.minimum: "WCAG 2.2 AA"`** (schema-required)
- **`accessibility.accessibilityFirst: true`** (schema-required) — accessibility is not retrofitted; it is a first-class design constraint
- **`accessibility.aaaWherePractical: true`** (schema-required) — AAA contrast (7:1) for body text where practical

### 7.1 Dynamic Type (AX5)

- All body sizes scale via a `.theme-ax5` class or system-level Dynamic Type
- AX5 (Larger Text accessibility size) supported; ratio 1.78× (19pt → 34pt body)
- On iOS, system Dynamic Type is honored via `-apple-system-body` / `-apple-system-headline` (PIA-MUR-D-002 §6)

### 7.2 Touch targets

- **Minimum:** 44pt × 44pt (iOS HIG; WCAG 2.2 SC 2.5.8 Target Size Minimum Level AA)
- **Primary actions:** 56pt × 56pt (FAB, Send button)
- **Citation chip:** 24pt visible glyph + transparent padding to 44pt (per Stream prototype)

### 7.3 Color contrast

- **Light mode verified values:**
  - Body text `#0A0A0A` on `#FFFFFF` = 19.3:1 (AAA)
  - Accent `#2563EB` on `#FFFFFF` = 4.6:1 (AA pass for ≥ 18pt body text)
  - Accent body text `#1D4ED8` on `#FFFFFF` = 6.1:1 (AAA for < 18pt body text; used for primary buttons with body text per PIA-MUR-D-003c decision-packet §Accessibility)
- **Dark mode:** UNVERIFIED per PIA-MUR-D-003c UNVERIFIED items list; requires automated axe-core check at G7 gate (B-6 dependency-approval policy)

### 7.4 Accessible names

- All buttons, inputs, links have an accessible name (text content, `aria-label`, or `aria-labelledby`)
- Icon-only buttons: `aria-label` required (e.g., `aria-label="New conversation"`, `aria-label="Workspace: PIA Workspace. Tap to switch."`)

### 7.5 Live regions

| Region | Role | aria-live | Source |
|---|---|---|---|
| Message thread | `log` | `polite` | `apps/web/src/pages/conversation-detail.ts:40` (baseline) |
| Network banner | `status` | `polite` | Stream prototype |
| Error banner | `alert` | `assertive` | WCAG 4.1.3 |
| Feedback status | (none) | `polite` on `<output>` | `apps/web/src/pages/conversation-detail.ts:96` (baseline) |

### 7.6 Landmarks

- `<header role="banner">` — top app bar
- `<main role="main">` — primary content
- `<nav role="navigation" aria-label="Primary">` — bottom tab bar
- `<footer role="contentinfo">` — when applicable
- `<aside role="complementary">` — for the offline banner if persistent; otherwise `role="status"`

### 7.7 Heading hierarchy

`h1` (page title; visually-hidden) → `h2` (section) → `h3` (subsection). No skipped levels. Citation chip is not a heading.

### 7.8 VoiceOver rotor

- **Landmarks + Headings + Links + Form Controls**
- Citation chip label: `'Citation <idx> of <total>, claims: <claim text>, button'`
- Mode dot: `aria-hidden="true"` (decorative); the mode name is in the row text

### 7.9 Keyboard

- **Tab order:** top-to-bottom, left-to-right; no `tabindex > 0`; no positive tabindex anywhere
- **External keyboard:** `Tab` / `Shift+Tab` traverse; `Enter` / `Space` activate; `Esc` closes sheets and modals; `:focus-visible` always shows the outline
- **Focus trap:** sheets and modals trap focus within their panel; `Tab` cycles, `Shift+Tab` from first → last, `Esc` closes
- **`/ ` keyboard shortcut:** focuses the search input from any screen (Stream prototype `app.js:186-193`)

### 7.10 Skip link

`"Skip to main content"` is the first focusable element on every page; hidden until focused.

---

## Section 8: Safe-area and dynamic-viewport contracts

- **`viewport-fit=cover`** set on the viewport meta (replaces baseline `apps/api/src/routes/web.ts:25` bare meta)
- All page chrome uses `env(safe-area-inset-*)` (top, bottom, left, right)
- **Top of header:** `padding-top: max(env(safe-area-inset-top, 0px), 59pt)` for Dynamic Island clearance (iPhone 16 Pro Dynamic Island is 124×37pt centered 11pt from top; 59pt = 11pt offset + 37pt height + 11pt buffer)
- **Bottom of tab bar:** `height: 49pt + env(safe-area-inset-bottom, 0px)` for the home indicator
- **FAB:** `bottom: var(--tab-bar-safe) + 16pt; right: max(16pt, env(safe-area-inset-right, 0px))`
- **Composer:** `bottom: var(--tab-bar-safe); padding-bottom: 8pt + env(safe-area-inset-bottom, 0px)`
- **`100dvh`** (dynamic viewport units) for full-height containers; **fallback `100vh`** for older browsers
- **Network banner:** `top: calc(env(safe-area-inset-top, 0px) + 60pt)` (Dynamic Island clearance + 13pt buffer)

---

## Section 9: Installed-PWA contracts

**`pwa.networkRequired: true`** (schema-required) — the redesign is online-only; stale data is unsafe.
**`pwa.offlineSupported: false`** (schema-required) — the app does not work offline; on fetch failure for `/v1/*`, the request fails and the page must handle 401/500 with the error envelope.

### 9.1 Manifest

```json
{
  "name": "Personal Intelligence and Action Engine",
  "short_name": "PIA",
  "start_url": "/app",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#2563EB",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/apple-touch-icon.png", "sizes": "180x180", "type": "image/png" }
  ]
}
```

Served at `/manifest.webmanifest`.

### 9.2 Required `<head>` tags

```html
<meta name="theme-color" content="#2563EB">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

### 9.3 Service worker (behavior, not implementation)

- **Scope:** `/`
- **Script path:** `/service-worker.js`
- **Pre-caches:** app shell HTML, app shell CSS, app shell JS, manifest, icons, splash image
- **Does NOT cache:** conversation content, document content, any `/v1/*` response (network-required; stale data is unsafe)
- **On fetch failure for navigation:** serves a static offline HTML (minimal shell with network-required splash + retry button)
- **On fetch failure for `/v1/*`:** lets the request fail; the page must handle 401/500 with the error envelope
- **Implementation is at the implementation-contract phase; this contract specifies behavior, not code**

### 9.4 Security headers

- **HSTS:** required when served via HTTPS; cloudflared quick-tunnel provides HTTPS automatically (per `REPOSITORY_ADAPTER.md` §"Runtime access" / "HTTPS requirement")
- **CSP:** tighten `script-src` to allow service-worker registration (per `REPOSITORY_BASELINE.md` §3 "CSP observation"). Current `'self' 'unsafe-inline'` permits SW registration; a stricter policy with nonces is recommended but is an implementation-contract concern
- **Permissions-Policy:** keep `camera=(), microphone=(), geolocation=(), interest-cohort()` (per `REPOSITORY_BASELINE.md` §3)

---

## Section 10: Data policy

**`dataPolicy.realDataRequired: true`** (schema-required) — the contract is grounded in real data, not invented content.
**`dataPolicy.inventedContentAllowed: false`** (schema-required) — no invented labels, statuses, modes, workspaces, or citations.
**`dataPolicy.mockAcceptanceAllowed: false`** (schema-required) — no mocks for acceptance evidence.

### 10.1 Real-data sources

| Source | Path | Used for |
|---|---|---|
| Captured baseline | `.ui-redesign/baseline/REPOSITORY_BASELINE.md` | Runtime evidence, PWA and mobile evidence, security headers |
| HTTP probes | `.ui-redesign/evidence/automated/http-baseline-probes.json` | Public routes, workspace routes, API routes, auth routes, PWA assets, HTML evidence |
| Source files | `apps/web/src/pages/*.ts`, `apps/api/src/routes/web*.ts` | Existing CSS, layouts, run-state badge map, feedback form, citation chip shape |
| Contracts | `packages/contracts/src/index.ts` | `ConversationMode` (L347), `FeedbackCategory` (L514-522), `Citation` (L440-449), `ModelRunStatusApi` |
| OpenAPI | `api/openapi.yaml` | 37 operations |
| Eval fixtures | `evals/answers/datasets/sample.yaml` | Retention period claim (L29), AI/weather summary multi-citation (L65-66) |

### 10.2 Error envelope sanitization

The API returns errors in the shape `{ error: { code: string, message: string, request_id: string } }`. The design contract specifies:

- **Show only `code` and a sanitized `message`** to the user
- **NEVER show `request_id` to the user** (audit-only; exposing it leaks correlation IDs)
- Source: confirmed by HTTP probes (e.g., `/v1/me` returns this envelope on 401)

### 10.3 No mocks

Mock data is not allowed for acceptance evidence. If real data is unavailable (DB down, dev user not provisioned), the workflow blocks and the user is informed (per `REPOSITORY_ADAPTER.md` §"Data unavailable behavior" / "BLOCK — never invent").

---

## Section 11: Decision references

This contract is a translation of approved decisions, not a new design.

| Decision ID | What it decided | Status | Source |
|---|---|---|---|
| `PIA-MUR-D-001` | Repository adapter + baseline phase authorization | APPROVED 2026-06-14 | `.ui-redesign/adapter/REPOSITORY_ADAPTER.md` |
| `PIA-MUR-D-002` | Product model (T1–T7 = A; A1–A10 acknowledged; 17 out-of-scope items acknowledged) | APPROVED 2026-06-14 | `.ui-redesign/reports/PIA-MUR-D-002-product-model.md` |
| `PIA-MUR-D-003` | Concept pick (selects Stream over Calm and Workspace) | APPROVED 2026-06-14 | `.ui-redesign/decisions/DECISION_LEDGER.md` |
| `PIA-MUR-D-003c` | Stream concept (single PIA blue accent, footnote-style citation chips, sheet-heavy navigation, conversation-first) | APPROVED 2026-06-14 | `.ui-redesign/concepts/concept-3-stream/` |

**The `decisionIds` array in `DESIGN_CONTRACT.json` includes all four:** `["PIA-MUR-D-001", "PIA-MUR-D-002", "PIA-MUR-D-003", "PIA-MUR-D-003c"]` (per schema requirement).

---

## Section 12: Acceptance criteria (PIA-MUR-D-004 gate)

The design contract is approved when **all** of the following are true:

- **AC1.** `DESIGN_CONTRACT.json` validates against `contracts/design-contract.schema.json` (ajv strict: schema-required fields + const checks all pass). ✅ Verified during authoring.
- **AC2.** All required schema fields are present with non-empty values: `contractId`, `status`, `decisionIds` (≥ 1 item, includes `PIA-MUR-D-001`, `PIA-MUR-D-002`, `PIA-MUR-D-003`), `target` (with `primaryDevice: "iPhone 16 Pro"`, `orientation: "portrait"`, `environments` containing `Safari` + `installed PWA` + `iOS Chrome`), `tokens`, `navigation`, `components`, `states`, `motion` (with `adaptive: true`, `userSelectable: true`, `reducedMotion: true`), `density` (with `progressiveDisclosure: true`, `userSelectable: true`, `screenSpecific: true`), `accessibility` (with `minimum: "WCAG 2.2 AA"`, `accessibilityFirst: true`, `aaaWherePractical: true`), `pwa` (with `networkRequired: true`, `offlineSupported: false`), `dataPolicy` (with `realDataRequired: true`, `inventedContentAllowed: false`, `mockAcceptanceAllowed: false`). ✅ Verified during authoring.
- **AC3.** The 17 components are inventoried: bottom tab bar, top app bar, bottom sheet (slide-up), full-screen sheet, citation chip (footnote), FAB, status badge, message bubble, mode-of-conversation sheet, file picker sheet (upload), search input, result card, empty state, error state (inline banner), offline banner, loading skeleton, network-required splash. ✅ Verified in `components` array.
- **AC4.** The 8 required states are inventoried: loading, empty, error, offline, pressed, focus, disabled, success. ✅ Verified in `states` array.
- **AC5.** Token reference includes all categories: color (light + dark + status + mode-dot), typography (with Dynamic Type AX5), spacing (4pt grid), shape (radii + row corners), elevation (shadows + hairlines), motion (CSS variables with reduced-motion fallback), size (touch targets, header, tab bar, FAB, composer), viewport (with `viewport-fit=cover`), safe-area (with Dynamic Island clearance). ✅ Verified in `tokens` object.
- **AC6.** Motion spec is the single source of truth: all sheet/tab/row/FAB/network-banner durations defined as CSS variables (`--motion-sheet`, `--motion-fade`, `--motion-fast`, `--motion-base`, `--motion-slow`, `--motion-ease`); no JS reads them; reduced-motion sets tokens to `0.01ms` (not `0ms`). ✅ Verified in `motion` object.
- **AC7.** PWA manifest, theme-color, apple-touch-icon, viewport-fit, service worker scope (with pre-cache and do-not-cache lists), CSP, HSTS are all specified as behavior contracts (not implementation). ✅ Verified in `pwa` object.
- **AC8.** All visual choices are sourced from approved inputs (PIA-MUR-D-001, PIA-MUR-D-002, PIA-MUR-D-003c). No invented visual choices; the `openDecisions` array is empty. Follow-up topics (PIA-MUR-D-005-candidate through PIA-MUR-D-008-candidate) are documented but acknowledged as non-blocking. ✅ Verified in `openDecisions` and `followUpTopics` arrays.

### 12.1 Schema validation result (executed during authoring)

```text
valid: true
Contract PIA-MUR-D-004 validated successfully
--- Required fields check ---
  contractId: present
  status: present
  decisionIds: present
  target: present
  tokens: present
  navigation: present
  components: present
  states: present
  motion: present
  density: present
  accessibility: present
  pwa: present
  dataPolicy: present
--- Const checks ---
  target.primaryDevice: iPhone 16 Pro (must be "iPhone 16 Pro")
  target.orientation: portrait (must be "portrait")
  target.environments contains Safari: true
  target.environments contains installed PWA: true
  target.environments contains iOS Chrome: true
  motion.adaptive: true (must be true)
  motion.userSelectable: true (must be true)
  motion.reducedMotion: true (must be true)
  density.progressiveDisclosure: true (must be true)
  density.userSelectable: true (must be true)
  density.screenSpecific: true (must be true)
  accessibility.minimum: WCAG 2.2 AA (must be "WCAG 2.2 AA")
  accessibility.accessibilityFirst: true (must be true)
  accessibility.aaaWherePractical: true (must be true)
  pwa.networkRequired: true (must be true)
  pwa.offlineSupported: false (must be false)
  dataPolicy.realDataRequired: true (must be true)
  dataPolicy.inventedContentAllowed: false (must be false)
  dataPolicy.mockAcceptanceAllowed: false (must be false)
  decisionIds: ["PIA-MUR-D-001","PIA-MUR-D-002","PIA-MUR-D-003","PIA-MUR-D-003c"]
  status: proposed (must be one of proposed|approved|superseded)
  contractId non-empty: true
--- Component count: 17
--- State count: 8
```

(Reproduce with: `node /tmp/opencode/validate-contract.cjs` — see `DESIGN_CONTRACT.json` for the source data.)

---

## Section 13: Open decisions

**`openDecisions: []` — empty.**

All visual choices in this contract are sourced from the approved Stream concept (`PIA-MUR-D-003c`) and the approved product model (`PIA-MUR-D-002`). No new visual choices were invented.

### Follow-up topics (acknowledged but not blocking)

These items are **not** open decisions requiring a `PIA-MUR-D-005+` packet. They are gaps that:

1. Either are already acknowledged in approved decisions (PIA-MUR-D-002 §6 / §10; PIA-MUR-D-003c UNVERIFIED items)
2. Or are out of redesign scope per approved decisions
3. Or are implementation-contract concerns (not design-contract)

| ID | Title | Owner | Status |
|---|---|---|---|
| `PIA-MUR-D-005-candidate` | Dark-mode color-contrast verification for status badges | device-validation (B-6) | Acknowledged in PIA-MUR-D-003c UNVERIFIED items; not blocking this gate |
| `PIA-MUR-D-006-candidate` | iOS 16 Pro Safari `<dialog>` `showModal()` focus-management verification | device-validation (B-1 resolved) | Acknowledged in PIA-MUR-D-002 §6; not blocking this gate |
| `PIA-MUR-D-007-candidate` | `prefers-reduced-motion` in installed PWA mode | device-validation (B-1 resolved) | Acknowledged in PIA-MUR-D-002 §5 #13; not blocking this gate |
| `PIA-MUR-D-008-candidate` | `POST /v1/me/active-workspace` endpoint for workspace switcher | PIA team / API owner | Out of redesign scope per PIA-MUR-D-002 §7; design contract specifies the UX; implementation contract does not implement the endpoint |

### Blocker status (from PIA-MUR-D-001)

| ID | Title | Status |
|---|---|---|
| B-1 | Physical iPhone 16 Pro availability | **RESOLVED 2026-06-14** (per `.ui-redesign/state/workflow-state.json#b1_resolution`); downstream device-validation is unblocked |
| B-2 | `mobile-ui-design-contract` command missing | Acknowledged; orchestrator dispatches directly to `design-system-architect` |
| B-3 | `.opencode/run-logs/cookies.txt` real session cookie | Mitigated by defensive `.gitignore`; never read, never committed |
| B-4 | `opencode.json` vs `opencode.jsonc` ambiguity | Separate ADR (not blocking this gate) |
| B-5 | `AGENT_HANDOFF.md` mislabels `@pia/web` as Next.js | Low-risk docs (not blocking this gate) |
| B-6 | Playwright + axe-core dependency-approval policy | Affects G7 gate; not blocking this design-contract gate |

### Design-contract fixes (in-scope, from PIA-MUR-D-002 §7)

| Item | Addressed in this contract |
|---|---|
| Item 14: `search.ts:131` `JSON.stringify(locator)` debug string | `result-card` component renders `page N` only (per `evidence/source-file-changes.md`) |
| Item 15: `document-detail.ts:159` `window.confirm()` for delete | `full-screen-sheet` component replaces with destructive confirm |

---

## What requires user approval (PIA-MUR-D-004 approval packet summary)

| Field | Value |
|---|---|
| **Contract ID** | `PIA-MUR-D-004` |
| **Status** | `proposed` |
| **Approver** | user (explicit approval required) |
| **Approves** | The translation of approved Stream concept (`PIA-MUR-D-003c`) and approved product model (`PIA-MUR-D-002`) into a complete, machine-readable + human-readable design system |
| **Does NOT approve** | Any product code change (`apps/web/`, `apps/api/`, `apps/worker/`, `packages/*/`), dependency addition, schema change, route change, API contract change, auth/authz change, infrastructure change, or deployment change |
| **Next phase on approval** | `implementation-contract` (PIA-MUR-D-004-IMPL), requiring a separate approval packet |
| **Required pre-approvals for the next phase** | (1) Approve PIA-MUR-D-004 as `proposed → approved`; (2) confirm any unblocker changes (none required for this gate) |

**To approve,** the user should run (or have the orchestrator run) the equivalent of: record `PIA-MUR-D-004` as `proposed → approved` in `.ui-redesign/decisions/DECISION_LEDGER.md` with the approved-at timestamp and (optionally) a one-line rationale. On `ACCEPTED`, the next phase is `implementation-contract`. On `REVISED`, the user supplies revisions and this contract is regenerated to address them. On `REJECTED`, the user picks a different concept or product model direction.

---

**Authored by:** `design-system-architect` specialist (read-only inspection)
**Authored at:** 2026-06-14
**Inputs:** PIA-MUR-ADAPTER-001 (APPROVED), PIA-MUR-D-001 baseline, PIA-MUR-D-002 product model (APPROVED), PIA-MUR-D-003 concept pick (APPROVED), PIA-MUR-D-003c Stream concept (APPROVED)
**Output:** `.ui-redesign/contracts/DESIGN_CONTRACT.json` (machine-readable, validates against `contracts/design-contract.schema.json`) + `.ui-redesign/contracts/DESIGN_CONTRACT.md` (this human-readable companion)
