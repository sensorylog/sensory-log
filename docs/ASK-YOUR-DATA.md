# Ask Your Data — Phase I

Ask Your Data is a local-first exploration layer over Sensory Log's existing data engines.

## Architecture

Raw entries remain the source of truth:

entries → state engine + pattern engine + personal model → constrained query → answer

The deterministic query engine executes the actual analysis. An optional AI provider may translate a natural-language question into a constrained query intent, but the provider does not get authority to invent calculations or write data.

## Supported intents

- summary
- trend
- relationship
- helpful
- drains
- recovery
- manual

Queries are limited to 7, 30, 90 days or all recorded days.

## Evidence and privacy

Every result includes a provenance block with the analyzed date range and sample size. Results are descriptive and avoid diagnosis and causal claims.

The local query engine requires no Firebase, Gemini, Puter, network, account, or subscription.

If an external AI provider is used for natural-language interpretation, the existing explicit AI-sharing controls remain the boundary. No provider is required for local analysis.

## Examples

- “Give me a 7-day summary.” → summary / 7
- “What tends to drain me?” → drains / 30
- “What helps?” → helpful / 30
- “How has my energy changed?” → trend / 30
- “What have I learned about myself?” → manual / 30
