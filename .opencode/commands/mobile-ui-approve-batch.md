---
description: Present multiple pending items as a single approval packet.
agent: mobile-ui-orchestrator
---

$ARGUMENTS

Group the specified items into a single approval packet. Maximum 5 items per batch.

For each item, present:

- Decision or commit ID
- One-line summary
- Risk level (HIGH / MEDIUM / LOW)
- Automated-check status (pass / fail / pending / not applicable)

Format rules:

- List HIGH-risk items first with [HIGH RISK] tag
- HIGH-risk items require explicit acknowledgment from the user
- If the user says "approve all except [ID]", approve the accepted items and re-present the rejected one separately

After batch approval, record each item's approval individually in the decision ledger with the batch ID as the approval reference.

If any item requires protected-area, dependency, schema, or auth changes, flag it as HIGH risk regardless of its other properties.
