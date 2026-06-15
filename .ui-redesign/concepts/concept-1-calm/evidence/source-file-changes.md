# Calm — Source-file change list (read-only inspection)

This list identifies lines in the existing source files that the **design contract** and **implementation contract** phases would need to touch to make Calm real. Concepts are visual prototypes only; no code is modified by this deliverable.

## apps/api/src/routes/web.ts

- **L25** `viewport` meta — change `width=device-width, initial-scale=1.0` to `width=device-width, initial-scale=1.0, viewport-fit=cover` so `env(safe-area-inset-*)` resolves.
- **L46** Body — keep system font; add `:root { color-scheme: light dark; }` and remove the hard-coded `background: #f5f5f5; color: #1a1a1a;` so `prefers-color-scheme: dark` works.
- **L131** `<html lang="en">` — add `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `theme-color`, and `<link rel="manifest" href="/manifest.webmanifest">` (out of scope for Calm concept; flagged for the PWA-intent design-contract task).

## apps/web/src/pages/shared.ts

- **L8-66** `sharedCss` — replace inline token-less CSS with CSS custom properties for `--bg`, `--fg`, `--divider`, `--status-*`, etc. so dark mode and dynamic theming work.
- **L60-62** `.tab-bar` (a top tab bar) — **delete** for mobile shell. The top tab bar is replaced by a bottom tab bar (T1=A) and a top header (T4=A).
- **L126-192** `pageShell` — emit `<header role="banner">`, `<nav role="navigation" aria-label="Primary">`, `<main role="main">`, and **remove the workspace-tabs `<div class="tab-bar">` block** (L151-157). Header gets avatar (top-left) and title (centered).

## apps/web/src/pages/conversation-list.ts

- **L36-48** `<table>` — convert to a card list (or a list of `<li>` rows) so it reflows at 393pt.
- **L22-35** "New conversation" form — **delete**; replaced by FAB (T7=A) on the conversation list. The mode selector becomes a bottom sheet (M1) of 6 large radio rows.

## apps/web/src/pages/conversation-detail.ts

- **L45** `<dialog id="citation-modal">` — keep the native `<dialog>` element; the Calm sheet animates from the bottom and uses the same element. **Caveat (UNVERIFIED):** iOS Safari `showModal()` focus behavior is documented as historically unreliable (`PIA-MUR-D-002` §6); fallback: a custom `role="dialog"` element with a focus trap.
- **L100-104** `renderCitationChipClient` — Calm renders the chip as text-only `[N]` with a 44×44pt tap target, color `#2563EB`, no background pill.
- **L81-98** `renderFeedbackFormClient` — replace the `<select>` (native iOS picker is large and opaque — see `PIA-MUR-D-002` §6) with a bottom-sheet-of-options triggered by a "Feedback" button on the assistant message.
- **L270-303** `handleSseEvent` — keep as-is; the in-page stream is unchanged. Add `announce()` calls for every `run.started`, `response.completed`, `run.failed` transition to satisfy the `aria-live` thread (`L40`).

## apps/web/src/pages/document-list.ts

- **L22-34** `<table>` — convert to a card list at 393pt. Header row removed.
- **L99-103** `statusBadgeHtml` — keep, but route the existing keys (`READY`, `PROCESSING`, `FAILED`, `QUARANTINED`, `UPLOADED`, `PENDING`) through a new CSS class system so colors come from `--status-*` tokens.
- **L18-21** "+ Upload" header button — **delete**; replaced by FAB (T7=A).

## apps/web/src/pages/search.ts

- **L131** `JSON.stringify(r.locator)` — **delete** (PIA-MUR-D-002 §7 item 14). Calm renders locator as `page N` or `position N` via the same logic the citation modal already uses (`conversation-detail.ts:170-172`).
- **L133-137** score-bar trio (`Lex:`, `Vec:`, `Fuse:`) — collapse to a single `Fuse: 0.943` chip on mobile, since the trio is illegible at 393pt.
- **L13-156** full form layout — re-flow to a sticky single-row search input at the top of the screen with a single "Search" button at thumb reach.

## apps/web/src/pages/upload.ts

- **L23** `Maximum size: 50 MB.` — keep the constraint; the FAB opens a sheet that **imports** this form (with a "Choose file" button → camera / Files / iCloud Drive, title field, primary "Upload" action). The full page route remains for desktop fallback (per `PIA-MUR-D-002` §4 row 5).
- **L61-135** submit handler — unchanged.

## apps/web/src/pages/document-detail.ts

- **L158-170** `window.confirm()` for delete — **replace** with a destructive-confirm bottom sheet (PIA-MUR-D-002 §7 item 15).
- **L120-135** "Ingestion Jobs" hard-coded empty — keep as a known limitation; not a Calm concern.
- **L49-56** "Ingestion Jobs" table — convert to a row list at 393pt.

## apps/web/test/a11y-static.test.ts

- **L1-156** — extend with: (a) test that the bottom tab bar uses `role="navigation"` with `aria-label="Primary"`, (b) test that the citation `<dialog>` has a focus trap, (c) test that the FAB is `aria-label`'d "New conversation" or "Upload document", (d) test that destructive-confirm replaces `window.confirm`. **All UNVERIFIED in the current test suite.**

## packages/contracts/src/index.ts

- **L347** `ConversationMode` — unchanged. All 6 values used by Calm.
- **L440-449** `Citation` — unchanged. `source_locator: Record<string, unknown>` is the real shape; the citation sheet renders `page N` / `position N` per `conversation-detail.ts:170-172`.
- **L514-522** `FeedbackCategory` — unchanged. The feedback sheet enumerates all 8 values.

## Notes

- All changes above are **redesign** changes inside the design-system phase, not new dependencies. The repository adapter permits them at the design-contract and implementation-contract phases (`PIA-MUR-D-001`).
- No schema, route, API contract, auth, infra, or deployment changes are required by Calm.
- The manifest, service worker, `apple-touch-icon`, `theme-color`, and `viewport-fit=cover` are PWA-intent tasks and are tracked separately (PIA-MUR-D-002 §4 rows 9-14).
