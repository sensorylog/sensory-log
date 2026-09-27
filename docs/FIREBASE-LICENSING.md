# Sensory Log — Firebase Licensing

## Architecture

Sensory Log uses Firebase Authentication for identity, a Cloudflare Worker for license activation/revalidation, and Firestore for the server-side entitlement record.

The browser never contains a master license key and never decides that a Gumroad purchase is valid.

### Activation

1. Customer buys Sensory Log through Gumroad.
2. Gumroad supplies a unique license key.
3. Customer creates/signs into a Sensory Log Firebase account.
4. The browser sends the license key to `activateLicense`.
5. The Worker endpoint function verifies the key with Gumroad's license verification endpoint.
6. The function hashes the key and stores only the hash in Firestore.
7. The user's entitlement is attached to the Firebase UID.
8. Sensory Log unlocks.

Gumroad's license verification API supports `product_id`, `license_key`, and an optional use-count increment. Gumroad also lets sellers manage license use counts, disable keys, and change seats from its dashboard. citeturn5search1turn5search3

## Two-device access

Each license can be active on up to **2 devices** at the same time. The browser creates a stable random device identifier and sends it only during license activation/revalidation. The Worker stores only a SHA-256 hash of that device identifier.

- Existing device: allowed and its last-seen time is updated.
- New device: allowed until the license has 2 active devices.
- Third device: blocked until an existing device is removed by the future admin tooling.
- Clearing browser storage or using a different browser can create a new device identity, so device removal/transfer support belongs in the admin dashboard.

This is a device limit, not a restriction on the user's Firebase account itself.

## Revalidation

A normal activation increments Gumroad's license use count. Routine revalidation uses `increment_uses_count=false` so opening the app does not consume activations.

The browser caches only non-secret entitlement metadata for up to 14 days as an offline convenience. The entitlement includes the two-device limit. On later sign-ins, the client calls the Worker in `register` mode so the current device is counted without asking the customer to paste the license key again. The raw Gumroad license key is never persisted by Sensory Log. The cache is not a security boundary and is not used by Firebase Rules. Online Firebase entitlement state remains authoritative.

## Data model

```
users/{uid}
  product: sensory-log
  entitlement:
    status: active
    licenseHash
    productId
    purchaseId
    verifiedAt
  updatedAt

licenses/{sha256}
  uid
  product: sensory-log
  productId
  status: active
  purchaseId
  uses
  createdAt
  updatedAt
```

Raw license keys are not stored in Firestore.

## Security

- Firebase Authentication identifies the user.
- Firestore Rules allow a user to read only their own entitlement.
- Clients cannot write entitlement records.
- The Worker endpoint requires Firebase Auth; App Check enforcement can be added/strengthened separately.
- Gumroad verification happens server-side.
- App Check should be monitored before enforcement and then enforced in production. Firebase documents App Check enforcement for Worker endpoint functions and recommends monitoring before enabling enforcement. citeturn1search3turn1search7

## Important deployment requirement

The licensing backend runs on a Cloudflare Worker, so Sensory Log does not require Firebase Blaze for this architecture. Firebase Auth, Firestore, Hosting and App Check remain on the Firebase Spark plan where eligible. citeturn1search4

## Firebase Console setup

Before production activation:

1. Enable Email/Password in Authentication.
2. Enable Google in Authentication if Google sign-in is desired.
3. Add the production hosting domain to Authentication authorized domains.
4. Create the Gumroad product with unique license keys enabled.
5. Copy the Gumroad Product ID.
6. Set the Cloudflare Worker secret `GUMROAD_PRODUCT_ID`.
7. Register Sensory Log with Firebase App Check and verify the production domain.
8. Configure the Worker secrets, including `ALLOWED_ORIGINS`.
9. Deploy the Cloudflare Worker and Firestore Rules.
10. Test a real Gumroad license, a deliberately invalid key, and activation from two different devices.

Google sign-in is supported by Firebase Authentication; on mobile, Firebase recommends redirect-based flows in general, although the current implementation uses popup for simplicity and should be revisited if mobile popup behavior proves unreliable. citeturn6search0turn6search1

## Deliberate boundary

The future admin dashboard is a separate application. It should use privileged server-side/admin APIs and must never ship Firebase Admin credentials to Sensory Log.


## Blaze-free backend

Sensory Log does not require Firebase Blaze for licensing. Firebase Authentication, Firestore, Hosting and App Check remain in Firebase. The license verification backend runs on a Cloudflare Worker Free plan. The Worker verifies the Firebase ID token, verifies the Gumroad license, and writes the entitlement to Firestore using a service-account secret held by Cloudflare. Cloudflare Workers Free currently allows 100,000 requests/day. 

The service-account JSON must never be committed to GitHub or shipped to the browser. Configure it as a Cloudflare Worker Secret.