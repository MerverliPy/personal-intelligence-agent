# Concept 3 — "Stream"

**Decision ID:** `PIA-MUR-D-003c`
**Status:** `PROPOSED` (awaits user pick)
**Phase:** `concept-production` (after `PIA-MUR-D-002` approval)
**Honors:** T1=A (3 tabs, Conversations default), T2=A, T3=A, T4=A (header avatar), T5=A, T6=A, T7=A
**Target device:** iPhone 16 Pro portrait, 393×852pt logical viewport.
**Network requirement:** Network-required PWA; no offline scope.

---

## Thesis

**Stream** is a conversation-first, content-forward concept that treats the conversation tab as the default landing and the dominant surface of the product. The premise: in a retrieval-augmented chat product, the conversation is the primary work surface, and the documents / search are inputs to the conversation, not destinations. The visual system minimises nav chrome and lets the message thread breathe; the FAB is the only creation entry, the citation chips are footnote-style text markers (matching the existing `[N]` shape), and the workspace switcher lives in the header avatar (T4=A).

Three tabs (Conversations / Documents / Search). Conversations is the default landing and the visual identity of the app — every visual decision flows from the idea that "the thread is the app". The Document and Search tabs are reachable in 1 tap and act as "inventory" / "lookup" surfaces that support the conversation.

## Key visual decisions

- **Single accent color.** The same PIA blue `#2563EB` for primary actions, citation chips, and active-tab indicator. No second accent; status badges inherit from `apps/web/src/pages/shared.ts:40-47`.
- **Sheet-heavy navigation.** Citation modal, workspace switcher, mode-of-conversation, and feedback form are all bottom sheets — no full-page modals except for destructive confirms. The "app" is a stack of sheets over a single conversation thread.
- **Generous type scale.** 19pt body, 14pt caption, 24pt section title, 32pt large title. Slightly larger than Calm (17/13/22/28) to put more emphasis on the conversation. AX5 still reflows but the thread becomes 2-line-per-message instead of 3-line.
- **3-tab bottom bar.** Conversations / Documents / Search. The order prioritizes the conversation as the first tab (left side, where the thumb naturally rests). Tabs are 1/3 width each.
- **Composer (T5=A):** text-only with iOS dictation as system affordance. Sits at the bottom and grows with content (max 8 lines).
- **Network-loss banner (T6=A):** persistent top banner below the Dynamic Island; disables destructive actions.
- **FAB (T7=A):** a 56pt PIA blue circle in the bottom-right of the Conversations and Documents tabs. On Documents it opens an upload sheet; on Conversations it opens the mode-of-conversation sheet.

## What makes Stream materially distinct

Stream trades:

- **3 tabs and Conversations as default.** Stream is the only concept that explicitly treats the conversation as the dominant surface. Calm also defaults to Conversations, but Calm's design is symmetric across the 3 tabs; Stream's design treats the conversation as the "home" and the other two as supporting.
- **Larger type and tighter tabs.** The slightly larger body text (19pt vs 17pt) gives the conversation more visual weight, but the rows in the Documents and Search lists become shorter (fewer items per screen).
- **Content-forward chrome.** The header is minimal (avatar + title); there is no settings cog or filter button. The user is meant to be "in" the conversation.

Stream gains:

- **Citation discoverability.** The footnote-style `[N]` chips (matching the existing `renderCitationChipClient` shape) are familiar to anyone who has read a Wikipedia article with footnotes. The tap target is 44pt and the visible glyph is small, leaving the message text to dominate.
- **Sheet micro-interactions.** Stream's signature is the 280ms slide-up sheet with a spring-like overshoot. Reduced-motion users get an instant snap. The sheets stack: a citation sheet from inside a conversation, opened from a message that was itself rendered from a streamed SSE delta.
- **Reduced motion safety.** Stream is the most reduce-motion-aware of the three concepts: every animation explicitly defines a fallback to `0.01ms`; the sheet slide-up uses a CSS variable (`--motion-sheet`) so a single token change disables all sheets.

## What Stream sacrifices

- **Discoverability of less-frequent actions.** Without a settings cog, the user has to swipe-down the workspace switcher sheet to find "Sign out" or "Settings". Mitigation: the avatar is always in the top-left.
- **Density.** At 19pt body, fewer rows fit per screen. A 30-row document list becomes a 22-row list. For power users, this is a slight regression.
- **No 4th tab.** Stream cannot represent workspace as a peer tab. The user has multiple workspaces? The avatar is the gateway.

## What Stream gains

- **Reduced cognitive load.** The conversation tab is always the first thing the user sees; "what is this app?" is answered immediately.
- **Single accent color → consistent identity.** A single accent color across the entire app gives the product a strong visual identity. The blue is the "PIA blue"; every interactive element either uses the blue or stays neutral.
- **Streaming-pacing narrative.** The conversation detail is the most heavily-used surface; Stream's design optimizes for it. The composer, the citation chips, the message thread, and the feedback form all get more visual real estate.

## Evidence citations

| Element | Source |
|---|---|
| Workspace name placeholder | `apps/api/src/routes/web.ts:108` |
| Conversation modes | `apps/web/src/pages/conversation-list.ts:25-30` |
| Citation chip shape `[N]` | `apps/web/src/pages/conversation-detail.ts:100-104` |
| Run-state badge map | `apps/web/src/pages/conversation-detail.ts:330-338` |
| Document status badge classes | `apps/web/src/pages/shared.ts:40-47` + `apps/web/src/pages/document-list.ts:99-103` |
| Feedback category list | `apps/web/src/pages/conversation-detail.ts:84` |
| Sensitivity classes | `packages/contracts/src/index.ts:207-213` |
| Sample assistant text | `evals/answers/datasets/sample.yaml:29` |
| Multi-citation sample | `evals/answers/datasets/sample.yaml:65-66` |

## Non-goals (explicitly deferred to design-contract)

- The streaming SSE delta-rendering (`conversation-detail.ts:305-318`) is mirrored in the prototype: the assistant message is appended in a single frame per delta. The implementation contract will preserve this behavior; the design contract will validate that the chip-rendering function (`renderCitationChipClient` at L100-104) and the citation modal are not blocked by the 30+ citation stutter flagged in `PIA-MUR-D-002` §6.
- The 6-mode conversation selector is rendered as a sheet with one row per mode (matches M1 in `PIA-MUR-D-002` §3).
- The destructive-confirm bottom sheet for `document-detail.ts:159` is **out of Stream's scope** in the prototype; Stream shows the document list, not the detail page, and the detail page's confirm-replace is a separate design-contract task.

## Stream default-landing question (for the user)

Stream **proposes Conversations as the default landing**, matching Calm's default and treating the conversation as the dominant surface. The user can override this in the decision packet.
