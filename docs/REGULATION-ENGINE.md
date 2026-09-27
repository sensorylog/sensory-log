# Regulation Engine

Phase F connects the current derived state to a small, evidence-aware regulation plan.

## Flow

raw entries -> state engine -> regulation engine -> suggested need -> action -> user feedback

The engine is deterministic and local-first. It does not diagnose, prescribe treatment, or require AI/network access.

## Priority

The engine considers:
1. high sensory load
2. low capacity
3. high recovery need
4. low social battery
5. elevated masking

If none is dominant, it returns an observation-first plan.

## Guardrails

- Suggestions are optional.
- Current signals are shown as the basis for a suggestion.
- Confidence is displayed rather than hidden.
- Manual mode selection remains available.
- Regulation feedback is saved into the existing local entry contract.
- Existing regulation scenes and timer remain available.

## Future

Later phases can add personalized regulation scenes and recovery tracking without replacing the deterministic state-to-need layer.
