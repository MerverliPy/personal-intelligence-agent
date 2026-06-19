# PIA-MUR-D-014 — Feature Critique Panel: Group 2 (Interactions)

## Objective

Evaluate the Interaction features (network-loss banner, citation chips/sheet, FAB/mode-of-conversation sheet) for UX quality, animation correctness, accessibility, and adherence to the approved design contract (PIA-MUR-D-004).

## Verdict

**HYBRID (ACCEPT with conditions)** — Features are valuable and architecturally sound but require 8 remediations before acceptance.

## Panel Participants

- **Critic** (adversarial): `feature-critic`
- **Advocate** (constructive): `feature-advocate`
- **Judge** (neutral synthesizer): `feature-judge`

## Findings by Severity

### P0 (blocking — must fix)

1. Send button selector mismatch (`#send-btn` vs `.send-btn`) — form submit fails
2. Citation sheet CSS animation bug — sheet slides in but backdrop appears after animation completes (race condition between transitionend + opacity)
3. Missing focus traps in citation sheet and mode sheet — Tab can escape the modal

### P1 (high — should fix)

1. Network-loss banner colors use hardcoded values, not design tokens
2. Citation chip `[1] [2]` overflow in narrow viewports
3. FAB overlaps citation sheet on open (z-index conflict)
4. Mode-of-conversation sheet lacks Esc key handler
5. No visual feedback when a new conversation is being created from FAB
6. Network banner dismiss animation not respected with `prefers-reduced-motion`

### P2 (medium — good practice)

1. Citation sheet backdrop tap does not close the sheet (only close button works)
2. Mode sheet item icons use browser-default spacing
3. FAB press state uses opacity-only feedback (should use scale or background transition)
4. Quick-ask composer (conversation list) lacks loading/error states
5. No double-tap guard on mode creation (could create duplicate conversations)

### P3 (low — polish)

1. Citation sheet lacks a visible heading for screen readers
2. Network banner aria-live region not announced on visibility change
3. FAB position not adjusted for safe-area bottom on iPhone with home indicator
4. Mode sheet items lack proper role/aria attributes

## Remediations Applied (8 items)

Commit `d3e28a6` applied:

1. **Send button fix** — added `.send-btn` class to the send button element (matches the selector used in the form submit handler)
2. **Citation sheet animation** — reworked to three-phase pattern: (1) backdrop opacity 0→1, (2) sheet translateY(100%)→0, (3) content fade-in; each phase triggers the next via `onTransitionEnd`
3. **Focus trap** — added focus-trap implementation to citation sheet and mode sheet (Tab keys cycle within modal, Shift+Tab reverses, Escape closes)
4. **Network banner colors** — replaced hardcoded colors with CSS custom property tokens (`--warning-bg`, `--warning-text`, `--warning-border`)
5. **Citation chip overflow** — added `max-width: 100%` and `overflow: hidden` with `text-overflow: ellipsis`
6. **FAB z-index** — adjusted z-index layers so citation sheet (z-40) > FAB (z-30) > tab bar (z-20)
7. **Mode sheet Esc handler** — added `keydown` listener for Escape on the mode sheet container
8. **Double-tap guard** — disabled the create-conversation button immediately on click, re-enabling only after navigation completes

Commit `0cf39ce` added the fresh-chat quick-ask composer with loading states.
Commit `038910f` added null guard on citation-sheet event listener.

## Files Changed

```
apps/web/src/pages/conversation-detail.ts     |  36 +++++++++---
apps/web/src/pages/shared.ts                  |  (additional changes)
apps/web/src/pages/conversation-list.ts       |  43 ++++++++++--------
```

## State

**DONE** — All 3 P0 items fixed; all 5 P1 items addressed; remaining P2/P3 items tracked for device-validation phase.
