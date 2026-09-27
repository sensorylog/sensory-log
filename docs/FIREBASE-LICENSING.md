# Sensory Log — Firebase Licensing

## Architecture

Sensory Log uses Firebase Authentication for identity, a 2nd-generation callable Cloud Function for license activation/revalidation, and Firestore for the server-side entitlement record.

The browser never contains a master license key and never decides that a Gumroad purchase is valid.

### Activation

1. Customer buys Sensory Log through Gumroad.
2. Gumroad supplies a unique license key.
3. Customer creates/signs into a Sensory Log Firebase account.
4. The browser sends the license key to `activateLicense`.
5. The callable function verifies the key with Gumroad's license verification endpoint.
6. The function hashes the key and stores only the hash in Firestore.
7. The user's entitlement is attached to the Firebase UID.
8. Sensory Log unlocks.

Gumroad's license verification API supports `product_id`, `license_key`, and an optional use-count increment. Gumroad also lets sellers manage license use counts, disable keys, and change seats from its dashboard. citeturn5search1turn5search3

## Revalidation

A normal activation increments Gumroad's license use count. Routine revalidation uses `increment_uses_count=false` so opening the app does not consume activations.

The browser caches the last verified entitlement for up to 14 days as an offline convenience. That cache is not a security boundary and is not used by Firebase Rules. Online verification remains authoritative.

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
- The callable functions require Auth and App Check.
- Gumroad verification happens server-side.
- App Check should be monitored before enforcement and then enforced in production. Firebase documents App Check enforcement for callable functions and recommends monitoring before enabling enforcement. citeturn1search3turn1search7

## Important deployment requirement

Cloud Functions deployment requires the Firebase project's pay-as-you-go Blaze plan and creates managed build infrastructure. The Sensory Log static hosting and local-first app do not need Functions; the licensing backend does. Firebase documents this deployment requirement. citeturn1search4

## Firebase Console setup

Before production activation:

1. Enable Email/Password in Authentication.
2. Enable Google in Authentication if Google sign-in is desired.
3. Add the production hosting domain to Authentication authorized domains.
4. Create the Gumroad product with unique license keys enabled.
5. Copy the Gumroad Product ID.
6. Set the Functions parameter `GUMROAD_PRODUCT_ID`.
7. Register Sensory Log with Firebase App Check and verify the production domain.
8. Monitor App Check traffic before enforcement changes.
9. Deploy Functions and Firestore Rules.
10. Test a real Gumroad license and a deliberately invalid key.

Google sign-in is supported by Firebase Authentication; on mobile, Firebase recommends redirect-based flows in general, although the current implementation uses popup for simplicity and should be revisited if mobile popup behavior proves unreliable. citeturn6search0turn6search1

## Deliberate boundary

The future admin dashboard is a separate application. It should use privileged server-side/admin APIs and must never ship Firebase Admin credentials to Sensory Log.
