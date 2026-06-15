# Workspace — Source-file change list (read-only inspection)

This list identifies lines in the existing source files that the **design contract** and **implementation contract** phases would need to touch to make Workspace real. Concepts are visual prototypes only; no code is modified by this deliverable.

## apps/api/src/routes/web.ts

- **L25** `viewport` meta — change to `width=device-width, initial-scale=1.0, viewport-fit=cover`.
- **L29** body color/background — switch from `#1a1a1a` / `#f5f5f5` to two-tone neutrals (`#1F1B16` ink / `#F5F3EE` bg) + accent (`#2563EB`).
- **L49** `<h1>PIA</h1>` — the workspace shell is a desktop fallback only; the in-app header is rendered by the redesigned pages.

## apps/web/src/pages/shared.ts

- **L8-66** `sharedCss` — replace inline token-less CSS with CSS custom properties: `--bg`, `--ink`, `--ink-muted`, `--divider`, `--accent`, `--status-*`, plus sizing tokens (`--tab-bar-h: 56pt`, `--header-h: 48pt`, `--composer-h: 56pt`, `--fab-size: 56pt`, `--touch-min: 44pt`).
- **L20** `.card` — add the new card elevation (`0 1pt 3pt rgba(0,0,0,0.04)`) and the `--surface` background.
- **L40-47** status badge classes — keep; add dark-mode token overrides.
- **L60-62** `.tab-bar` (a top tab bar) — **delete** for mobile shell. The bottom tab bar is the new T1.
- **L126-192** `pageShell` — emit `<header role="banner">` with avatar, `<nav role="navigation" aria-label="Primary">` with 4 tab buttons, `<main role="main">`. Remove the top tab-bar block (L151-157).

## apps/web/src/pages/conversation-list.ts

- **L22-35** "New conversation" form — **delete**; replaced by FAB (T7=A) and the mode-of-conversation sheet (M1).
- **L36-48** `<table>` — convert to a card list. Each card has: 32pt icon (mode letter), title, mode pill, timestamp, citation count, chevron. Minimum height 80pt; 12pt-radius card; 8pt gutter.

## apps/web/src/pages/conversation-detail.ts

- **L45** `<dialog>` — keep. The Workspace citation sheet uses a `<div class="sheet">` with `role="dialog"` because the Workspace FAB is in the bottom-right and the sheet has to overlay it; native `<dialog>` z-index conflicts with the FAB.
- **L100-104** `renderCitationChipClient` — Workspace renders filled blue pills: `<button class="cite-pill">{N}</button>` with `background: var(--accent); color: white;`. 22×22pt visible, 44pt tap target.
- **L81-98** `renderFeedbackFormClient` — replace `<select>` with a feedback sheet (similar to mode sheet, but with 8 categories + optional free-text correction textarea).
- **L347-366** `message-form` submit — unchanged shape, but the textarea is replaced by a `<textarea>` that grows with content.

## apps/web/src/pages/document-list.ts

- **L22-34** `<table>` — convert to a card list. Each card has: 32pt icon, title, status pill, sensitivity + version + size, chevron. The "processing" state shows a 3pt progress bar inline.
- **L99-103** `statusBadgeHtml` — keep the keys; route the styles through `--status-*` tokens.

## apps/web/src/pages/search.ts

- **L131** `JSON.stringify(r.locator)` — **delete** (PIA-MUR-D-002 §7 item 14). The Workspace card renders `page N` only (omitting the score-bar trio entirely; `Fuse 0.943` is the only number shown).
- **L13-156** full form layout — re-flow to a single-row sticky search input with a leading magnifier icon; result cards have rank + excerpt + status pill + locator + Fuse score.

## apps/web/src/pages/upload.ts

- **L23** `Maximum size: 50 MB.` — keep; the upload sheet (a new screen in the Workspace tab) imports the form shape. The full page route is preserved for desktop fallback.
- **L61-135** submit handler — unchanged shape.

## apps/web/src/pages/document-detail.ts

- **L158-170** `window.confirm()` — **replace** with a destructive-confirm bottom sheet (PIA-MUR-D-002 §7 item 15). The Workspace implementation uses a "Delete document" CTA at the bottom of the card list and a "Confirm delete" sheet with a "Type to confirm" input.

## apps/web/src/pages/document-list.ts (peer tab in Workspace)

- The Workspace tab is a new screen (not in the current `apps/web/src/pages/`). It renders a list of `Workspace` resources from `GET /v1/workspaces`. The current `/app` route at `apps/api/src/routes/web.ts:11-13` returns 302 to `/app`, and the shell at `apps/api/src/routes/web.ts:21-130` already calls `/v1/workspaces` and renders them. The redesign **replaces** the workspace shell's HTML with a mobile-first list of workspace cards.

## packages/contracts/src/index.ts

- **L77-81** `Workspace` — unchanged. The Workspace tab uses `id`, `name`, `created_at`. Membership roles come from `Principal.workspaces[].role` at L60-71.
- **L347** `ConversationMode` — unchanged.
- **L440-449** `Citation` — unchanged. `source_locator` rendered as `page N` per `conversation-detail.ts:170-172`.
- **L514-522** `FeedbackCategory` — unchanged.

## New screen (the Workspace tab)

The Workspace tab is a full-bleed screen that:

1. Fetches `GET /v1/workspaces` on mount.
2. Renders the list of workspaces as cards.
3. Marks the current workspace with a blue ring and a `✓` glyph.
4. Tapping another workspace triggers a POST to `/v1/me/active-workspace` (out of redesign scope; the API does not yet expose this endpoint — the design contract will flag this gap).
5. Provides a "Sign out" row at the bottom with a polite fallback message.

## Notes

- All changes are inside the design-system phase. No new packages, no new routes, no schema changes.
- The 4-tab layout changes the visual density; the design contract should validate that the `Dynamic Island` clearance is preserved at all 4 tab widths.
