---
description: Run the Feature Critique Panel (critic + advocate + judge) on a feature or design decision.
agent: mobile-ui-orchestrator
---

$ARGUMENTS

Run the Feature Critique Panel on the specified feature or design decision.

Step 1: Invoke `feature-critic` and `feature-advocate` in parallel with the feature description and context from the context cache.

Step 2: Collect both reports.

Step 3: Invoke `feature-judge` with both reports and the context cache.

Step 4: Present the judge's recommendation to the user:

- If ACCEPT: proceed with implementation
- If REJECT: explain why and suggest alternatives
- If HYBRID: present the combined approach for approval
- If REVISE: present the revision instructions and offer to re-run the panel after changes

Step 5: Record the critique result in the decision ledger as a new decision entry.

If the feature description is ambiguous, ask the user for clarification before invoking the panel.
