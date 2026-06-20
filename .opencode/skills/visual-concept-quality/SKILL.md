---
name: visual-concept-quality
description: Improve PIA mobile visual concepts before they become design decisions or contracts.
compatibility: opencode
metadata:
  audience: visual-concept-prototyper
  output: concept-critique
---

## Use this skill when

A task creates, reviews, or compares concept artifacts under `.ui-redesign/concepts/`, `.ui-redesign/reports/`, or `.ui-redesign/decisions/`.

## Rules

- Concepts are advisory until converted into an approved decision or contract.
- Use real product content and known PIA states.
- Produce at least two materially different directions when concept selection is open.
- Do not create new routes, data behavior, dependencies, or implementation scope through a concept.
- Preserve iPhone 16 Pro portrait, network-required PWA, safe-area, accessibility, and evidence-first product constraints.

## Concept checklist

Evaluate each concept for:

- product read: private intelligence, retrieval, citations, memory, and governed actions;
- primary flow clarity;
- bottom navigation, sheets, composer, citations, feedback, and status surfaces;
- loading, empty, error, disabled, streaming, interrupted, and offline states;
- density and reading comfort on 393 x 852 logical viewport;
- touch target clarity;
- evidence and citation legibility;
- trust-first tone;
- generic AI dashboard risk;
- implementation-contract readiness.

## Output

Return:

1. concept ID and inspected paths;
2. strengths;
3. weaknesses;
4. generic-pattern risks;
5. contract-ready details;
6. rejected details and why;
7. recommendation: ACCEPT, REJECT, HYBRID, or REVISE.
