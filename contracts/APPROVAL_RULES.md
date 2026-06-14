# Approval Rules

## Valid approval

A valid approval identifies:

- decision or contract ID;
- selected alternative or approved revision;
- any conditions;
- the approving user;
- the approval time recorded by the workflow.

Example:

```text
APPROVE D-014 ALTERNATIVE-B
Conditions:
- Preserve the current account route.
- No new runtime dependency.
- Validate on installed PWA before implementation acceptance.
```

## Invalid or ambiguous approval

The following do not authorize implementation by themselves:

- “looks good” when multiple packets are open;
- approval without an ID;
- approval of a visual screenshot that omits interaction behavior;
- approval of a concept without its dependency or backend impact;
- approval given before required evidence exists.

## Revocation

The user may revoke an approval. The orchestrator must:

1. stop affected work;
2. identify dependent changes;
3. preserve evidence;
4. revert or isolate work as appropriate;
5. update the ledger;
6. create a revised packet when requested.
