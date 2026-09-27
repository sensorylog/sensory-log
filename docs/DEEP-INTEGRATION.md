# Phase J — Deep Integration

Sensory Log remains a local-first PWA. Phase J adds a resilient app shell around the existing local data core.

## Included
- Service worker with same-origin shell caching and offline fallback.
- PWA manifest scope, standalone display, and quick actions.
- Service-worker registration that never blocks app startup.
- App-update event for a future calm update prompt.

## Boundary

The service worker caches only the application shell and same-origin GET responses. User entries remain in the existing IndexedDB/localStorage layer. No user data is uploaded by the service worker.

No wearable, native wrapper, push notification, or external account is required for the core app.

Future native/wearable integrations must feed the existing raw-signal → state-engine pipeline rather than creating a second data model.

## Offline behavior

After the shell has been installed once, the application can reopen its cached shell without a network connection. Local storage remains the source of truth for check-ins, patterns, regulation, manual, reports, and Ask Your Data.

## Update behavior

A newly installed service worker emits `sensory-log:app-update`. The UI can later expose a calm "Update available" action that sends `SKIP_WAITING` to the waiting worker.