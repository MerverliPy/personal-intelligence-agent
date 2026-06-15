# Concept 1 — "Calm"

**Decision ID:** `PIA-MUR-D-003a`
**Status:** `PROPOSED` (awaits user pick)
**Phase:** `concept-production` (after `PIA-MUR-D-002` approval)
**Honors:** T1=A, T2=A, T3=A, T4=A, T5=A, T6=A, T7=A (per `PIA-MUR-D-002` §9)
**Target device:** iPhone 16 Pro portrait, 393×852pt logical viewport.
**Network requirement:** Network-required PWA; no offline scope.

---

## Thesis

**Calm** is a minimalist, system-font-first concept that maximizes Dynamic Type legibility, reduce-motion safety, and VoiceOver rotor support. The visual system deliberately sheds custom icons, gradients, shadows, and decorative chrome so that the only signals are the system font, color, whitespace, and a single black accent. The premise: on a 393×852pt canvas, every pixel of chrome is a pixel the user cannot read.

Three tabs (Documents / Conversations / Search). Workspace switching lives in the top-left avatar. Profile is reachable from the workspace switcher sheet (no 4th tab). The bottom tab bar uses SF Pro Text at 10pt, a 49pt tab area, and 32pt SF Symbol glyphs rendered as outlined paths so the system applies its own weight/contrast adjustments to icons at AX5.

## Key visual decisions

- **One accent color.** Pure black `#000000` on a warm white `#FAFAF7` for light mode; pure white `#FFFFFF` on true black `#000000` for dark mode. No secondary accents; status colors (`#166534`, `#1E40AF`, `#991B1B`, `#6B21A8`) inherit from `apps/web/src/pages/shared.ts:40-47` to preserve color memory for status badges.
- **System font stack only.** `font: -apple-system, system-ui, sans-serif` at 17pt body, 13pt caption, 22pt section title, 28pt large title. No custom font files. Scales linearly with iOS Dynamic Type settings up to AX5.
- **Hairline separators.** 0.5pt `#E5E5E2` horizontal lines; no box-shadow, no card elevation. Reduces motion-induced repaint cost and respects Smart Invert.
- **3-tab bottom bar** (T1=A in 3-tab form). Documents / Conversations / Search. Workspace switcher moved to top-left avatar (T4=A) per iOS Mail pattern.
- **Composer uses iOS dictation as system affordance** (T5=A). No mic button. The textarea grows with content (max 6 lines) and snaps to bottom safe-area + keyboard inset via `env(safe-area-inset-bottom)`.
- **Persistent "Offline" banner** below the dynamic island on network loss (T6=A). Disables destructive actions (Delete, Submit feedback) but keeps navigation alive.
- **FAB on Documents and Conversations tabs only** (T7=A). The FAB is a 56×56pt circle in pure black with a white `+` glyph, anchored `bottom-right: max(16pt, env(safe-area-inset-right))` and `bottom: calc(56pt + 16pt + env(safe-area-inset-bottom) + 49pt)` (49pt is the tab bar height).
- **Citations as bracketed footnote-style numbers** `[1]`, `[2]` with no background pill. Tap target is 44×44pt with the visible glyph centered. This mirrors the existing `renderCitationChipClient` shape at `apps/web/src/pages/conversation-detail.ts:100-104` (`'[' + (index + 1) + ']'`) so future server-streamed chips land on a known visual.

## What makes Calm materially different

Calm trades:

- **Workspace-as-tab discoverability** (the Workspace tab in Concept 2). Workspace is reachable in 2 taps (avatar → row) instead of 1; the user pays a tap for a less-crowded tab bar.
- **Card elevation and visual hierarchy** (Concept 2). Calm uses hairline dividers between rows, not cards. Consequence: at AX5, body text and table-row text both grow, but row density tightens.
- **Custom symbols** (Concept 2). Calm uses text-only labels in the tab bar and plain path outlines for the FAB and citation glyphs. The system can re-render text labels at any Dynamic Type size; outlined paths scale uniformly.

## What Calm sacrifices

- **Visual hierarchy density.** A 30-row document list with hairline dividers is harder to scan than a 12-card grid. Compensated for by status pill (small, low-contrast).
- **Brand distinctiveness.** A pure black/white system looks like Mail, Notes, Settings. Distinguishable from competitors only through product substance.
- **Discoverability of less-frequent actions.** Sheet-of-options pattern for "New conversation" mode selection (T3=3 — Mode Selector, M1 — bottom sheet on "+ New"). New users may not know the 6 modes exist; mitigated by a one-line description below each radio row in the sheet.
- **Workspace switcher at 2 taps.** For users with ≥ 10 workspaces, the sheet must support search-as-you-type.

## What Calm gains

- **Dynamic Type AX5 support.** 17pt body → ~31pt at AX5 (per iOS scale: x1.0 → x1.55 → x1.8 → x2.0 → x2.35 → x3.0). All controls re-flow: row height = ceil(lineHeight × scale) + 16pt padding. No layout breakage.
- **Reduce-motion safety.** No sheet slide-up animation duration > 120ms; default is `0.01ms` per `@media (prefers-reduced-motion: reduce)`. No parallax, no transform-scaled FAB on press.
- **VoiceOver rotor.** `<header role="banner">`, `<nav role="navigation">`, `<main role="main">`, `<footer role="contentinfo">` landmarks present on every screen. Citation chips announce as "Citation 1 of 3, claims: Retention period is 7 years, button" (mirrors `apps/web/src/pages/conversation-detail.ts:101` label).
- **Smart Invert safe.** Hairline dividers invert cleanly; no card shadow to fight. Status badges use only WCAG-AA pairs from `shared.ts:40-47`.
- **Smallest concept bundle.** The interactive prototype's `index.html` + `styles.css` + `app.js` is the smallest of the three concepts because there is no SVG icon library to inline.

## Evidence citations

All real-data shapes are sourced from the existing repository:

| Element                       | Source                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| Workspace name placeholder    | `apps/api/src/routes/web.ts:108` (the "No workspaces yet…" empty state)                            |
| Conversation modes            | `apps/web/src/pages/conversation-list.ts:25-30`                                                    |
| Citation chip shape `[N]`     | `apps/web/src/pages/conversation-detail.ts:100-104`                                                |
| Citation modal `<dialog>`     | `apps/web/src/pages/conversation-detail.ts:45`                                                     |
| Run-state badge map           | `apps/web/src/pages/conversation-detail.ts:330-338`                                                |
| Document status badge classes | `apps/web/src/pages/shared.ts:40-47` + `apps/web/src/pages/document-list.ts:99-103`                |
| Feedback category list        | `apps/web/src/pages/conversation-detail.ts:84` (mirrors `packages/contracts/src/index.ts:514-522`) |
| Assistant text fixture        | `evals/answers/datasets/sample.yaml:29` ("The retention period is 7 years.")                       |
| Multi-citation fixture        | `evals/answers/datasets/sample.yaml:65-66`                                                         |
| Document title fixture        | `evals/answers/datasets/sample.yaml:26, 58, 61` (policy, AI, weather)                              |

## Non-goals (explicitly deferred to design-contract)

- The stand-alone "+ Upload" page route is preserved at `/app/workspaces/{wid}/upload` for desktop fallback (per `PIA-MUR-D-002` §4 row 5), but the mobile entry-point is the FAB.
- A custom 404 page is not redesigned; the current `apps/api/src/routes/web.ts` shell is preserved.
- The `/auth/logout` 404 (B-2 surface) is not solved in this concept; the workspace switcher sheet still surfaces a "Sign out" row that falls back to the documented "Sign out from the desktop app" workaround per `PIA-MUR-D-002` §4 BLOCKED-gap note.
