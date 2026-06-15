# Workspace — Default-landing question (for the user)

The product model (`PIA-MUR-D-002`) does not specify a default landing tab. The three concepts propose three different answers:

| Concept       | Default landing          | Rationale                                                                              |
| ------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| 1 — Calm      | Conversations            | Treats "ask the AI" as the primary action; matches Stream.                             |
| 2 — Workspace | **Documents** (proposed) | Treats the workspace as an "inventory" — the user sees what is in the workspace first. |
| 3 — Stream    | Conversations            | Treats "ask the AI" as the primary action; matches Calm.                               |

The user must pick a default landing before the design-contract phase. The decision is recorded in `FEATURE_PARITY_MATRIX.md` and propagated to the implementation.

## Arguments for Documents (proposed)

- The Workspace tab is **always reachable in 1 tap** from any other tab; the user never loses context.
- A user resuming from the home screen is more likely to want to "see what's new in the workspace" than to "ask a question" — the workspace state is the user's primary context.
- The Document list is the most "browsable" surface; Conversation is more "transactional" (the user knows what they want to ask).
- Documents is the natural landing for a PWA installed on a Home Screen: tap the icon → see your stuff.

## Arguments for Conversations

- Conversations is the F1 critical flow (`PIA-MUR-D-002` §2 row 1).
- A user resuming from the home screen on a phone is more likely to want to continue a conversation than to scan documents.
- Most LLM products (ChatGPT, Claude) default to the conversation list.

## Arguments for Workspace (rare)

- Useful if the user has many workspaces and frequently switches between them.
- Treats the app as a "workspace chooser" first.

## Recommendation

**Documents** is the recommended default for Workspace (Concept 2). The reasoning is that the Document list is the most informative surface for a returning user: it shows "what's in the workspace", the status of recent uploads, and the count of conversations. From Documents, the user can tap a conversation in the list to go to detail, or switch to the Conversations tab in 1 tap.

If the user disagrees, the orchestrator can record the override in `.ui-redesign/decisions/DECISION_LEDGER.md` and propagate the change to the implementation contract.
