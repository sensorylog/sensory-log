# Phase H — Signal

Signal is the external context layer of Sensory Log.

## Principles

- Small and curated, not an endless engagement feed.
- Every item has a source, date, category, and evidence level.
- HTTPS sources only.
- Duplicate IDs are removed deterministically.
- Items are sorted by publication date.
- Personalization is optional and happens locally from explicitly declared manual preferences.
- Check-ins, notes, and other private history are never uploaded or sent to feed providers.
- Signal availability must never block the core local-first app.

## Evidence levels

- **primary** — the item points to a primary research, institutional, or first-party source.
- **reported** — the item summarizes or reports information from another source.
- **perspective** — lived experience, commentary, or a clearly identified viewpoint.

An evidence level describes provenance; it does not mean the underlying claim is true or clinically established.

## Flow

\`approved feed -> validation -> normalization -> optional local personalization -> Signal UI\`

The engine is deterministic and has no network dependency. Network retrieval remains an optional input to the existing UI.

## Privacy boundary

Only declared manual preferences may influence local ordering. Raw check-ins, notes, reports, and private history are not sent to Signal providers.
