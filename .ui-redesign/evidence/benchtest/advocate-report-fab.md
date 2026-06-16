# Feature Advocate Report

## Feature: Floating Action Button (FAB)

## Verdict: STRONG_VALUE

### Strengths (value-ranked)

#### High Value

1. **Single-tap creation from any tab**: The FAB provides a persistent, always-visible creation action that requires zero navigation. On Conversations tab, one tap opens the mode sheet. On Documents tab, one tap opens the upload sheet. This is the fastest path to "create something" in the entire app. **Evidence**: DESIGN_CONTRACT.json:306-322 (FAB definition with contextual triggers).

2. **iOS-native interaction pattern**: The FAB is a well-understood mobile pattern (Google Material Design, widely adopted in iOS apps). iPhone users expect it. The 56pt size exceeds the 44pt minimum, the brand-tinted shadow creates depth, and the scale-down press animation (0.94) provides haptic-like feedback. **Evidence**: DESIGN_CONTRACT.json:507-535 (anatomy, states, motion).

3. **Offline safety**: The FAB disables at 40% opacity when offline, preventing users from initiating actions that would fail. This is a critical guardrail for a network-required PWA. The `ariaDisabled: true` ensures screen reader users also know the action is unavailable. **Evidence**: DESIGN_CONTRACT.json:315, 524.

#### Medium Value

4. **Contextual intelligence**: The FAB adapts its action to the current tab context. This eliminates the need for separate "New" and "Upload" buttons scattered across screens, reducing chrome and keeping the interface clean. **Evidence**: DESIGN_CONTRACT.json:316-319 (3 different triggers based on active tab).

5. **Focus accessibility**: The FAB has a 3pt white outline focus ring with 2pt offset, making it clearly visible for keyboard users. The `ariaLabel` is contextual ("New conversation" or "Upload document"), providing clear screen reader guidance. **Evidence**: DESIGN_CONTRACT.json:313, 321.

#### Low Value

6. **Visual hierarchy**: The FAB is the only elevated element in the entire design system (shadow + brand color). This makes it the clear primary action without competing with other UI elements. The principle "FAB is the only elevated element" is clean and intentional. **Evidence**: DESIGN_CONTRACT.json:175.

### Opportunities

1. **Long-press for power users**: A future iteration could add long-press to directly start a specific mode (ASK, RESEARCH, etc.) without opening the mode sheet. This would delight power users without affecting the primary flow.
2. **Contextual badge**: The FAB could show a small badge indicating pending actions (e.g., "2" for queued uploads when coming back online).
3. **Haptic feedback**: On iPhone, the press-in animation could be paired with a subtle haptic tap (UIImpactFeedbackGenerator) for enhanced tactile response.

### Questions for the Critic

1. The critic raises "contextual behavior invisibility" — but the FAB always shows a "+" icon. Is the action surprise actually a problem, or is the "+" universally understood as "create something new"?
2. Regarding the offline opacity concern — is this any different from how native iOS apps handle disabled buttons? Apple's own apps use opacity alone for disabled states.

### Enhancement Suggestions

1. Add a subtle tooltip on first use ("Tap to start a new conversation") that dismisses after 3 uses.
2. Consider adding a micro-animation when switching tabs that subtly hints at the FAB's changed action (e.g., a brief icon morph).
3. Ensure the FAB's aria-description includes the current tab context for screen reader users.
