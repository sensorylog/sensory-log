# Phase K — Product Polish

Phase K hardens Sensory Log for public use with the Firebase/Cloudflare purchase access system; the separate admin dashboard remains outside this app.

## Included

- Privacy Center with local-storage status and destructive local-data deletion.
- Backup remains the recovery path before deletion.
- Clear separation between core local logging and optional external services.
- Public-facing product copy aligned with the current local-first architecture.
- Accessibility and preference controls remain first-class.
- Firebase Authentication supports email/password and Google accounts.
- Gumroad license verification runs through the server-side Cloudflare Worker.
- Each license supports up to two active devices.
- The separate admin dashboard is intentionally outside this app.
- No subscription, streak, score, or artificial scarcity is introduced.

## Deletion contract

Delete removes Sensory Log-owned local IndexedDB data and Sensory Log-owned localStorage keys. It does not claim to delete copies that were exported or intentionally sent to an external provider.

## Release rule

The local journal remains usable without AI or network access after entitlement is established. Account/licensing services are required for first-time activation and new-device entitlement registration.
