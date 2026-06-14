---
name: design-contract
description: Convert approved concepts into a human-readable and machine-readable design system covering tokens, components, states, navigation, motion, density, accessibility, safe areas, viewport behavior, and network-required PWA behavior.
compatibility: opencode
metadata:
  output: design-contract
  validation: json-schema
---

## Contract contents

- target environments;
- semantic tokens;
- component anatomy and states;
- navigation;
- loading, error, empty, and disconnected states;
- progressive disclosure;
- density settings;
- adaptive and user-selectable motion;
- reduced motion;
- themes;
- accessibility;
- safe-area and dynamic-viewport behavior;
- keyboard and forms;
- installed-PWA behavior;
- data policy;
- decision references.

Validate the JSON contract against `contracts/design-contract.schema.json`. Any unresolved choice becomes a decision packet.
