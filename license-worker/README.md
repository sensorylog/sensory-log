# Sensory Log License Worker

This Cloudflare Worker replaces Firebase Cloud Functions for license verification so the Firebase project can remain on Spark.

## Secrets

Configure these as Cloudflare Worker **Secrets**, never in Git:

- FIREBASE_SERVICE_ACCOUNT_JSON — complete Firebase service-account JSON
- FIREBASE_WEB_API_KEY — Firebase web API key
- FIREBASE_PROJECT_ID — `sensorylog-3d630`
- GUMROAD_PRODUCT_ID — Sensory Log Gumroad product ID
- ALLOWED_ORIGINS — comma-separated production origins

Cloudflare documents Worker Secrets as encrypted bindings and recommends secrets rather than plaintext variables for sensitive values.

## Deploy

From this directory:

```bash
npx wrangler deploy
```

Then put the resulting Worker URL into Sensory Log as `LICENSE_WORKER_URL`.

Never commit service-account JSON, `.dev.vars`, or other secrets.

## Flow

The Worker receives a Firebase ID token, verifies the Firebase user through Google's Identity Toolkit, and verifies Gumroad licensing server-side. Activation accepts a Gumroad license key and records a SHA-256 license hash. Returning devices can use a registration request tied to the user's existing entitlement. A license is limited to two active device identities. Firestore writes use a server-only service account.

Activation increments Gumroad's license use count. Revalidation does not.

Cloudflare Workers Free currently allows 100,000 requests/day.
