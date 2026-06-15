# Concept 2 — "Workspace"

**Decision ID:** `PIA-MUR-D-003b`
**Status:** `PROPOSED` (awaits user pick)
**Phase:** `concept-production` (after `PIA-MUR-D-002` approval)
**Honors:** T1=A (4-tab variant), T2=A, T3=A, T4=A (also as tab), T5=A, T6=A, T7=A
**Target device:** iPhone 16 Pro portrait, 393×852pt logical viewport.
**Network requirement:** Network-required PWA; no offline scope.

---

## Thesis

**Workspace** is a workspace-context-first, card-rich concept that promotes the workspace switcher from a header affordance (Calm, Stream) to a **peer tab in the bottom bar**. The premise: in a multi-workspace product, the workspace boundary is the most important context signal, and pushing it to a header avatar hides it from muscle memory. The visual system uses card elevation, a two-tone neutral palette (warm grey + ink), and a single PIA blue accent (`#2563EB`) for primary actions.

Four tabs (Documents / Search / Conversations / Workspace). Each tab is a full-bleed card list. Tabs use custom outlined SF Symbol-style icons rather than system glyphs, giving the concept a more brand-distinctive feel. The bottom tab bar height is increased to 56pt to accommodate larger touch targets and the workspace-tab icon (a stacked-layers glyph that represents the workspace abstraction).

## Key visual decisions

- **Two-tone neutrals + 1 accent.** Warm grey `#F5F3EE` background, ink `#1F1B16` text, with a single PIA blue `#2563EB` accent for primary actions, citation chips, and the active tab. No gradients, no shadows beyond a single-card elevation (`0 1pt 3pt rgba(0,0,0,0.04)`).
- **Custom outlined tab icons** (24pt) — stack-of-layers for Workspace, document-with-magnifier for Search, chat-bubble for Conversations, file-stack for Documents. Inlined as SVG paths; no third-party icon font.
- **Card-rich lists.** Each list item is a 12pt-radius card with 12pt internal padding, separated by 8pt gutters (not hairline dividers). Card height ≥ 80pt so a thumbnail / status pill / two-line title fit comfortably.
- **Workspace tab is a peer of the others.** Tapping the Workspace tab opens a full-bleed page (not a sheet) that lists all workspaces the user has access to, with the current one marked. Tapping another workspace triggers the standard "switch workspace" flow (a hard navigation; the API supports it via the workspace context plugin).
- **Composer uses iOS dictation as system affordance** (T5=A). Same as Calm; the input grows with content and snaps to the safe-area.
- **Persistent "Offline" banner** (T6=A). Same as Calm; sits below the Dynamic Island.
- **FAB on Documents and Conversations tabs only** (T7=A). The FAB is a 56pt circular blue (`#2563EB`) button with a white `+` glyph, anchored bottom-right.
- **Citations as filled blue chips.** `[1]`, `[2]` rendered as 22×22pt filled blue squares with white text, distinct from Calm's text-only approach. Tapping is the same 44×44pt hit target; the visible glyph is centered.

## What makes Workspace materially different

Workspace trades:

- **4th tab real estate.** Workspace gains a peer tab, but the bottom bar shrinks to ~98pt per tab at 393pt (393 ÷ 4). This is still above 44pt but tighter than 3 tabs.
- **Card density for AX5 compatibility.** Cards reflow more slowly than hairline rows at AX5; at AX5, the body text grows from 17pt to 31pt and the cards become 4-line stacks. The list scrolls, but 30-row lists become 12-row lists.
- **Workspace discoverability.** Workspace is reachable in 1 tap (the bottom tab) instead of 2 (avatar → sheet). For users with ≥ 3 workspaces this is faster; for users with 1 workspace this is wasted chrome.

Workspace gains:

- **Brand distinctiveness.** Cards + PIA blue + custom icons read as "PIA" rather than "Apple Notes". The visual hierarchy (workspace as a tab) reinforces the multi-tenant story.
- **Install-to-Home-Screen UX.** A custom icon set is more memorable on the Home Screen than the system default; the user can recognize the PIA app among 5+ installed apps.
- **Stronger search affordance.** Search gets its own tab (T3=A) with a large search input at the top; in 3-tab concepts the search bar is hidden until the user taps the Search tab.

## What Workspace sacrifices

- **Larger tap targets at 4 tabs.** At 393pt ÷ 4 = 98.25pt per tab, the visible icon (24pt) and label (10pt) are well above the 44pt minimum, but the gap between the active-tab highlight and the inactive tabs shrinks. Touch fidelity is preserved.
- **Default landing ambiguity.** With 4 tabs, the "default landing" decision moves from "Conversations" to a question: "Which tab is the home tab?" Workspace treats the **Documents** tab as the default landing because the document list is the "inventory" of the workspace; Conversations is reachable in 1 tap. **Note:** This deviates from Calm and Stream, which both default to Conversations. The product model does not specify a default landing; the orchestrator should ask the user.
- **Workspace switching requires a tab change.** In Calm/Stream, the avatar reveals the current workspace name; in Workspace, the user must read the active tab to know the workspace. Mitigation: the avatar in the header always shows the current workspace letter.

## What Workspace gains

- **Custom iconography.** The tab icons are inlined SVG paths and can be re-tinted, animated, or replaced without breaking the layout. The "Workspace" tab icon (stacked-layers) is a metaphor that scales to "collections", "projects", or "folders" in the future.
- **Search as a primary surface.** With Search as a tab, the search bar is always at the top of the screen and the keyboard opens automatically on tap. Power users can `Cmd+K` / `/` to focus the search input.
- **Workspace cards.** The Workspace tab renders a list of cards — each workspace is a card with the workspace letter, name, role, and last-accessed timestamp. The "switch workspace" flow is a 1-tap, full-page navigation rather than a sheet.

## Evidence citations

| Element                       | Source                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| Workspace name placeholder    | `apps/api/src/routes/web.ts:108`                                                    |
| Conversation modes            | `apps/web/src/pages/conversation-list.ts:25-30`                                     |
| Citation chip shape `[N]`     | `apps/web/src/pages/conversation-detail.ts:100-104`                                 |
| Run-state badge map           | `apps/web/src/pages/conversation-detail.ts:330-338`                                 |
| Document status badge classes | `apps/web/src/pages/shared.ts:40-47` + `apps/web/src/pages/document-list.ts:99-103` |
| Feedback category list        | `apps/web/src/pages/conversation-detail.ts:84`                                      |
| Sensitivity classes           | `packages/contracts/src/index.ts:207-213`                                           |
| Sample assistant text         | `evals/answers/datasets/sample.yaml:29`                                             |
| Multi-citation sample         | `evals/answers/datasets/sample.yaml:65-66`                                          |

## Non-goals (explicitly deferred to design-contract)

- The 4-tab default-landing decision is **proposed as Documents** in the prototype; the user may pick Conversations. The default is recorded in the decision-packet acceptance criteria.
- The Workspace tab is a peer of Documents / Search / Conversations, **not** a top-level "Settings" or "Profile" surface. Profile is reachable from a settings cog in the Workspace tab.
- The PWA-intent assets (manifest, service worker, theme-color) are deferred; tracked separately.

## Workspace default-landing question (for the user)

The product model does not specify a default landing tab. Workspace proposes **Documents** as the default landing. The two alternatives are:

- **Conversations** (matches Calm and Stream; treats "ask the AI" as the primary action).
- **Workspace** (matches the conceptual "what is this app?" model; lets the user pick a workspace before doing anything).

The user should pick this before the design-contract phase. The default is recorded in `FEATURE_PARITY_MATRIX.md` as a per-screen decision.
