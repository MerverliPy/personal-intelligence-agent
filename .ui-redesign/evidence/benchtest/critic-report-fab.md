# Feature Critic Report

## Feature: Floating Action Button (FAB)

## Verdict: CONCERNS

### Findings (severity-ranked)

#### P0 — Blocking

_(none)_

#### P1 — Significant

1. **Contextual behavior invisibility**: The FAB changes its action based on the active tab (Conversations → "New conversation" sheet, Documents → "Upload document" sheet, Search → hidden). There is no visual indication of what the FAB will do until tapped. Users switching between tabs may be surprised by different behavior. **Evidence**: DESIGN_CONTRACT.json:316-319 (`trigger.conversationsTab`, `trigger.documentsTab`, `trigger.searchTab`).

2. **Offline state communicates via opacity only**: When offline, the FAB is disabled at 40% opacity. This is the only visual indicator. Users with visual impairments or in bright sunlight may not notice the opacity change. There is no tooltip, label change, or aria-live announcement explaining WHY it's disabled. **Evidence**: DESIGN_CONTRACT.json:315 (`disabled: 40% opacity when offline`), DESIGN_CONTRACT.json:524 (`ariaDisabled: true when offline`).

#### P2 — Moderate

3. **FAB position conflicts with composer on conversation detail**: The FAB is positioned at `bottom: var(--tab-bar-safe) + 16pt`. On the conversation detail screen, the message composer is also at `bottom: var(--tab-bar-safe)`. The FAB would overlap the composer. The design contract says FAB is hidden on search tab but does not explicitly state it's hidden on conversation detail. **Evidence**: DESIGN_CONTRACT.json:309 (FAB position), DESIGN_CONTRACT.json:209 (`composerHeight: 56pt`).

4. **No long-press or secondary action**: The FAB has a single tap action. On iOS, users increasingly expect long-press for secondary actions (e.g., long-press FAB to start a specific mode directly instead of opening the mode sheet). This is a missed opportunity for power users. **Evidence**: DESIGN_CONTRACT.json:517-522 (states: default, hover, focus-visible, active, disabled — no long-press state).

#### P3 — Minor

5. **Shadow uses brand color tint**: The FAB shadow is `rgba(37, 99, 235, 0.36)` — brand-tinted. This is visually distinctive but inconsistent with the design system's principle that "lists and chrome use hairlines" and "FAB is the only elevated element." The tinted shadow draws attention but may feel heavy in dark mode where the background is `#0A0A0A`. **Evidence**: DESIGN_CONTRACT.json:170 (`fabShadow: 0 6pt 20pt rgba(37, 99, 235, 0.36)`).

### Questions for the Advocate

1. How does contextual FAB behavior help users who switch between tabs frequently? Is the cognitive load of "what does this button do now?" worth the space savings?
2. The FAB is the ONLY creation action on Conversations and Documents tabs. If it's disabled offline, how does the user know WHY they can't create? Is opacity alone sufficient?

### Recommended Mitigations

1. **For P1-1**: Add a subtle tooltip or aria-label that changes per tab (already partially addressed by `ariaLabel` in the contract, but no visual tooltip exists).
2. **For P1-2**: Add a brief text label below the FAB when disabled ("Offline — creation disabled") or change the icon to include a small offline indicator.
3. **For P2-3**: Explicitly document that FAB is hidden on conversation detail screen (add to DESIGN_CONTRACT.json:319).
4. **For P2-4**: Consider adding a long-press state in a future iteration (not blocking for v1).
