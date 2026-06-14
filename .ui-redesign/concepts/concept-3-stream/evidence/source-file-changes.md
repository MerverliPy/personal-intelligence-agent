# Stream — Source-file change list (read-only inspection)

This list identifies lines in the existing source files that the **design contract** and **implementation contract** phases would need to touch to make Stream real. Concepts are visual prototypes only; no code is modified by this deliverable.

## apps/api/src/routes/web.ts

- **L25** `viewport` meta — change to `width=device-width, initial-scale=1.0, viewport-fit=cover` so `env(safe-area-inset-*)` resolves in the in-app shell.
- **L131** `<html lang="en">` — add PWA-intent meta tags (out of Stream concept scope; flagged for design-contract): `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `theme-color`, `<link rel="manifest" href="/manifest.webmanifest">`.

## apps/web/src/pages/shared.ts

- **L8-66** `sharedCss` — replace inline token-less CSS with CSS custom properties aligned to Stream's design tokens: `--bg: #FFFFFF`, `--fg: #0A0A0A`, `--fg-muted: #5C5C5C`, `--fg-subtle: #9C9C9C`, `--divider: #ECECEC`, `--accent: #2563EB`, `--accent-pressed: #1D4ED8`, `--selection: #DBE7FF`. Sizing tokens: `--tab-bar-h: 49pt`, `--header-h: 44pt`, `--composer-h: 56pt`, `--fab-size: 56pt`, `--touch-min: 44pt`. Stream's body type is 19pt (vs Calm's 17pt); the larger scale gives the conversation more visual weight.
- **L40-47** status badge classes — keep the 6 keys (`READY`, `INGESTING`, `PROCESSING`, `FAILED`, `QUARANTINED`, `UPLOADED`); route colors through `--status-*` tokens. Add a 7th state for `STREAMING` (used on assistant message `data-state`).
- **L60-62** `.tab-bar` (top tab bar) — **delete** for mobile shell. The 3-tab bottom bar (T1=A) replaces it.
- **L126-192** `pageShell` — emit `<header role="banner">` with avatar (T4=A), `<nav role="navigation" aria-label="Primary">` with 3 tab buttons, `<main role="main">`. Remove the top tab-bar block (L151-157).

## apps/web/src/pages/conversation-list.ts

- **L22-35** "New conversation" `<form>` — **delete**; replaced by FAB (T7=A) on the list. The mode-of-conversation sheet (6 radio rows) opens on FAB tap.
- **L36-48** `<table>` — convert to a list of `<li>` rows (`.conv`) with `min-height: 44pt` and `aria-label` per row. Each row shows title + relative time on row 1, and a colored 6pt mode dot + mode name + preview on row 2.
- **L25-30** 6-mode `<select>` — the stream prototype's `index.html` re-uses these 6 mode names (`ASK`, `RESEARCH`, `ANALYZE`, `PLAN`, `EXECUTE`, `LEARN`) but renders them as a bottom-sheet of radio rows (matches M1 in `PIA-MUR-D-002` §3).

## apps/web/src/pages/conversation-detail.ts

- **L45** native `<dialog id="citation-modal">` — Stream uses a custom `<div class="sheet">` with `role="dialog"` because the Stream FAB sits in the bottom-right and a native `<dialog>`'s z-index conflicts with the FAB shadow. The citation `<dialog>` is **kept as the inner surface**; the outer sheet wraps it for the slide-up animation. **UNVERIFIED:** iOS 16 Pro Safari `showModal()` focus-management.
- **L100-104** `renderCitationChipClient` — keep the existing `[N]` shape; Stream renders the chip as **text-only** (no background pill), `color: var(--accent)`, with a 0.5pt underline that animates to a full underline on `:hover`/`:focus-visible`. Visible glyph is small (16pt); the 44pt tap target is a transparent hit area around the glyph. This matches the existing `renderCitationChipClient` shape — Stream is the lowest-risk concept to implement for the citation chip.
- **L81-98** `renderFeedbackFormClient` — replace the native `<select>` (iOS picker is large and opaque) with a feedback sheet of 8 categories + optional free-text correction textarea. The "Feedback" link on the assistant message opens the sheet.
- **L270-303** `handleSseEvent` — keep as-is. The in-page stream is unchanged. The `aria-live="polite"` thread (`L40`) and the `appendAssistantDelta` single-frame append (L305-318) are preserved.

## apps/web/src/pages/document-list.ts

- **L22-34** `<table>` — convert to a list of `<li>` rows (`.doc`) with `min-height: 44pt` and a 32pt SVG file icon. Each row shows title + status pill + sensitivity + version + chevron. The icon stroke is `var(--accent)` for healthy docs and `#991B1B` for `FAILED` (matches the existing baseline colors).
- **L99-103** `statusBadgeHtml` — keep the keys; route the styles through `--status-*` tokens. The `INGESTING` key (used in the prototype) maps to the same blue as `PROCESSING` in the baseline.
- **L18-21** "+ Upload" header button — **delete**; replaced by FAB (T7=A) on the Documents tab. The FAB opens an upload sheet (file picker + title + "Upload" primary action).

## apps/web/src/pages/search.ts

- **L131** `JSON.stringify(r.locator)` — **delete** (PIA-MUR-D-002 §7 item 14). Stream renders the locator as `page N` only (omitting the score-bar trio entirely; the single `Fuse 0.943` chip is the only number shown).
- **L133-137** score-bar trio (`Lex:`, `Vec:`, `Fuse:`) — collapse to a single `Fuse: 0.943` chip on mobile. At 19pt body, the trio is illegible at 393pt.
- **L13-156** form layout — re-flow to a sticky single-row search input at the top of the screen (44pt height, 12pt-radius, hairline border); results as a list of `.result` cards with rank + excerpt + status pill + locator + Fuse score.

## apps/web/src/pages/upload.ts

- **L23** `Maximum size: 50 MB.` — keep; the upload sheet (a new screen in the Documents tab) imports the form shape. The full page route is preserved for desktop fallback.
- **L61-135** submit handler — unchanged shape.

## apps/web/src/pages/document-detail.ts

- **L158-170** `window.confirm()` for delete — **replace** with a destructive-confirm bottom sheet (PIA-MUR-D-002 §7 item 15). Stream uses a "Delete document" CTA at the bottom of the card list and a "Confirm delete" sheet.
- **L120-135** "Ingestion Jobs" hard-coded empty — keep as a known limitation; not a Stream concern.
- **L49-56** "Ingestion Jobs" table — convert to a row list at 393pt.

## apps/web/test/a11y-static.test.ts

- **L1-156** — extend with: (a) test that the 3-tab bottom bar uses `role="navigation"` with `aria-label="Primary"`, (b) test that the FAB is `aria-label`'d "New conversation" or "Upload document", (c) test that destructive-confirm replaces `window.confirm`, (d) test that citation chips are 44pt tap targets. **All UNVERIFIED in the current test suite.**

## packages/contracts/src/index.ts

- **L347** `ConversationMode` — unchanged. All 6 values used by Stream's mode sheet.
- **L440-449** `Citation` — unchanged. `source_locator: Record<string, unknown>` is the real shape; the citation sheet renders `page N` per `conversation-detail.ts:170-172`.
- **L514-522** `FeedbackCategory` — unchanged. The feedback sheet enumerates all 8 values.

## Notes

- All changes above are **redesign** changes inside the design-system phase, not new dependencies. The repository adapter permits them at the design-contract and implementation-contract phases (`PIA-MUR-D-001`).
- No schema, route, API contract, auth, infra, or deployment changes are required by Stream.
- The PWA-intent assets (manifest, service worker, `apple-touch-icon`, `theme-color`, `viewport-fit=cover`) are tracked separately in the PWA-intent rows of the parity matrix.

---

# Stream — Motion spec

All durations and curves honor `prefers-reduced-motion: reduce` (set to `0.01ms`). Stream is the **most reduce-motion-aware** of the three concepts: every animation explicitly defines a fallback to `0.01ms`; the sheet slide-up uses a CSS variable (`--motion-sheet`) so a single token change disables all sheets.

| Element | Property | Duration | Easing | Notes |
|---|---|---:|---|---|
| Tab switch (active state) | color, fill | 100ms | `linear` | Tab text/icon color transitions between `--fg-muted` and `--accent`. The 2pt top accent bar repaints on tab switch. |
| Row press | background | 80ms | `ease-out` | Tap-state highlight on `.conv` and `.doc` rows. |
| Row press release | background | 200ms | `ease-in-out` | Return to default. |
| FAB press | transform: scale | 100ms | `ease-out` | Scale 1.0 → 0.94. |
| FAB release | transform: scale | 200ms | `ease-in-out` | Back to 1.0. |
| Sheet open | transform: translateY | **280ms** | `cubic-bezier(0.32, 0.72, 0, 1)` | From `100%` to `0`. iOS-native sheet curve. **Stream uses a longer 280ms (vs Calm's 250ms) to give the signature slide a more deliberate feel.** |
| Sheet close | transform: translateY | 240ms | `cubic-bezier(0.32, 0.72, 0, 1)` | Reverse. |
| Backdrop fade | opacity | 200ms | `ease` | 0 → 0.4 alpha. |
| Network banner appear | transform: translateY | 220ms | `cubic-bezier(0.32, 0.72, 0, 1)` | Slides from -100% to 0. |
| Citation chip underline reveal | transform: scaleX | 200ms | `ease` | The footnote `[N]` underline animates from `scaleX(0.5)` to `scaleX(1)` on `:hover`/`:focus-visible`. |
| Streamed text reveal | n/a | 0ms | n/a | No character-by-character reveal; the entire delta is appended in a single frame (mirrors `appendAssistantDelta` at `conversation-detail.ts:305-318`). |

## Reduced-motion behavior

When `prefers-reduced-motion: reduce` is set OR the dev toggle `Reduce motion` is checked:

- `--motion-sheet: 0.01ms` and `--motion-fade: 0.01ms` are set at the root.
- All sheets snap open/closed instantly.
- Tab and row color transitions → instant.
- FAB scale → no transform.
- Network banner → instant.
- Citation chip underline → no animation.

The motion tokens are the single source of truth; the only animation the spec explicitly allows to remain at 0ms is the streamed-text reveal (which was never animated).

## Dark-mode timing

Dark-mode color transitions are 100ms `ease-out` to avoid flash. There is no logo-splash or app-launch animation. The `prefers-color-scheme: dark` query and the `.theme-dark` class both reduce the accent to `#3B82F6` and the body text to `#F5F5F5`.

## Scroll behavior

- `app-main` uses `-webkit-overflow-scrolling: touch` for iOS native momentum.
- Bounce-overscroll is allowed (the standard iOS rubber-band) but the body background matches the sheet panel background (`--bg`) so overscroll appears clean.
- Pull-to-refresh is **not** implemented in the prototype; it would be added in the implementation-contract phase.

## Touch target timing

- All interactive elements (rows, tabs, FAB, citation chips, send button, search input) have a tap target ≥ 44pt.
- The citation chip's visible glyph is 16pt but the 44pt hit area is preserved via transparent padding.
- Tap targets are hit-tested before hover (there is no hover on touch).
- The `touchstart` → `touchend` → `click` sequence is the standard 300ms delay only if `touch-action` is not set; Stream sets `touch-action: manipulation` on all interactive elements to remove the 300ms delay (UNVERIFIED: requires browser testing per `PIA-MUR-D-002` §5 item 13).

## Why Stream's motion is the most reduce-motion-aware

- The sheet animation uses a **CSS variable** (`--motion-sheet`), not a hard-coded duration. A single token change disables all sheet motion. Calm and Workspace hard-code the 250ms/280ms duration in the keyframes.
- The reduced-motion fallback is a `0.01ms` duration, not `0ms`. This is a documented trick: `0ms` is treated as "no animation" by some browsers and the element appears in its final state without animating; `0.01ms` ensures the animation is registered and the final state is reached via the animation's `to` keyframe, which is closer to iOS-native reduce-motion behavior.
- The motion-spec table is the **only** place that documents the durations; no JS reads them. This makes the spec the single source of truth and prevents drift between the spec and the code.
