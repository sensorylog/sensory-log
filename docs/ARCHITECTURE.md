# Sensory Log — Phase A Foundation

## Purpose

Phase A establishes the data boundary that every later phase must use. The application is local-first: the browser owns the user's core data, and optional network services are adapters around that data rather than prerequisites for logging.

## Canonical flow

    UI / feature modules
          |
          v
    domain contracts
          |
          v
    core/storage.js
          |
          +--> IndexedDB (primary)
          +--> localStorage (legacy/fallback)
          +--> export/import boundary

Later phases may add:

    local observations -> state engine -> personal model -> recommendations

Those layers must not bypass the storage contract.

## Data ownership

### Local-first

The following are local data:

- check-ins and historical observations
- personal operating-manual context
- preferences that affect the local experience
- cached, non-authoritative derived data

Firebase, Puter, Gemini, Signal feeds, and future integrations are optional service layers. A temporary service failure must not prevent the core local experience from opening or reading existing history.

### Cloud boundary

No cloud collection is authoritative for the core log in Phase A. Firebase rules therefore remain deny-by-default until a later phase introduces a concrete authenticated collection and matching rules.

Never place secrets, service-account credentials, license keys, or privileged API credentials in browser JavaScript.

## Data contract

js/core/schema.js is the canonical normalization boundary.

Rules:

1. Feature modules pass raw objects to the schema/storage boundary.
2. Stored entries are normalized before persistence.
3. Dates are calendar dates (YYYY-MM-DD), not UTC timestamps.
4. Unknown fields may exist in imported historical data but are not trusted as canonical fields.
5. Import is validation + normalization + merge; it is never blind replacement.
6. A later schema change must increment DATA_VERSION and include an explicit migration path.

## Storage contract

js/core/storage.js is the only Phase A persistence adapter.

- IndexedDB is the primary store.
- localStorage is a compatibility/fallback layer for existing installations and environments where IndexedDB is unavailable.
- Existing legacy entry keys remain readable.
- Writes prefer IndexedDB and only fall back to localStorage when IndexedDB cannot be used.
- Future settings/manual records should use the same adapter instead of creating new ad-hoc persistence keys.

## Migration contract

Migrations must be deterministic, idempotent, forward-only, safe to run more than once, and non-destructive unless the migration explicitly proves the old data is redundant.

A migration should never silently delete user data.

## Privacy contract

The product should make the local/cloud boundary understandable:

- core logging works without an account
- export is generated locally
- import is validated locally
- optional AI/network features must have an explicit sharing boundary
- no analytics should transmit raw journal content
- derived insights must be treated as derived, not as a replacement for raw observations

## Backup contract

JSON is the portable backup format. CSV is a flat interoperability format.

A valid JSON backup includes a format identifier, version, export timestamp, normalized entries, and supported local preferences/context. Import must reject malformed payloads and merge by calendar date.

## Rules for later phases

- Phase B may change presentation, not the data contract.
- Phase C may consume normalized observations and produce derived state; it must not redefine raw history.
- Phase D check-ins must write through the storage contract.
- Phase E patterns must be recomputable from raw history.
- Phase F regulation may record outcomes through the same contract.
- Phase G manual data remains user-owned local context.
- Phase H Signal data remains separate from personal history.
- Phase I AI may read an explicitly permitted projection of local data, never arbitrary storage.
- Phase J integrations are adapters and caches, not the source of truth.
- Phase K access/licensing gates product access, not ownership of already-local user data.

## Acceptance criteria for Phase A

- Existing users can still read their historical entries.
- Existing legacy localStorage entries can migrate to IndexedDB.
- Core data remains available when network services are unavailable.
- Import/export remains local.
- Storage access has one canonical module.
- Schema changes have an explicit version.
- Firebase remains deny-by-default until cloud data is intentionally introduced.
