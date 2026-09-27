# Pattern Intelligence

Phase E turns saved observations into deterministic, descriptive pattern summaries.

## Data flow

raw entries -> state engine -> pattern engine -> calm UI

The pattern engine never mutates raw entries and has no Firebase, AI, or network dependency.

## What it derives

- Baseline profile — recent averages with sample sizes.
- Recurring signatures — items repeatedly logged on lower-energy days.
- Signal relationships — descriptive group comparisons such as sleep quality vs next-day energy.
- Recovery curves — next-day energy grouped by recovery-need level.
- Long-term trends — earlier vs newer portions of a recent window.

## Evidence rules

- Comparisons require at least 3 observations per group.
- Missing values are excluded rather than converted into guesses.
- Relationships are descriptive and do not imply causation.
- No diagnosis, prediction, or clinical interpretation is produced.
- Raw observations remain the source of truth.
- The default analysis window is the most recent 30 logged days.

## Why this is separate from the UI

js/core/pattern-engine.js is pure domain logic. js/patterns.js is responsible for presentation and routing only. This keeps pattern calculations deterministic, testable, and reusable by future History, Ask Your Data, and reporting surfaces.

## Future extensions

Later phases can add richer personal signatures, relationship graphs, and AI interpretation without making the core pattern calculations depend on a network service.