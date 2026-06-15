# Workflow State Machine

| State                            | Entry requirement               | Required output                                        | Exit gate                  |
| -------------------------------- | ------------------------------- | ------------------------------------------------------ | -------------------------- |
| UNINITIALIZED                    | package installed               | none                                                   | `/mobile-ui-start`         |
| DISCOVERY                        | clean or acknowledged Git state | inventory and blockers                                 | discovery complete         |
| ADAPTER_PROPOSED                 | repository evidence             | adapter proposal                                       | explicit approval          |
| BASELINE_CAPTURED                | real runtime and real data      | baseline evidence                                      | evidence complete          |
| PRODUCT_MODEL_APPROVED           | product/users/outcomes proposal | approved product model                                 | explicit approval          |
| SCREEN_PRIORITY_APPROVED         | screen inventory                | ranked scope                                           | explicit approval          |
| CONCEPTS_READY                   | approved scope                  | distinct concepts and prototypes                       | packet completeness        |
| CONCEPT_APPROVED                 | concept packet                  | selected concept                                       | explicit approval          |
| DESIGN_CONTRACT_APPROVED         | selected concept                | design tokens, components, IA, motion, accessibility   | explicit approval          |
| IMPLEMENTATION_CONTRACT_APPROVED | design contract                 | files, phases, tests, dependencies, backend boundaries | explicit approval          |
| IMPLEMENTING                     | approved contract               | atomic commits                                         | contract scope complete    |
| AUTOMATED_VALIDATION             | implementation complete         | regression, a11y, performance, visual evidence         | all mandatory gates pass   |
| PHYSICAL_DEVICE_VALIDATION       | automated pass                  | physical iPhone report                                 | no unresolved disagreement |
| EVIDENCE_REVIEW                  | validation pass                 | final evidence bundle                                  | explicit acceptance        |
| PR_READY                         | accepted evidence               | PR and rollback plan                                   | user-directed merge        |
| COMPLETE                         | delivered package               | final handoff                                          | none                       |

## Blocking precedence

Security, credentials, real-data access, and physical-device availability block downstream states. The system must not downgrade these to warnings.
