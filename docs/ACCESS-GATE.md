# Sensory Log Access Gate

Sensory Log uses the same simple purchase-link model as the user's existing PaimonVault deployment, adapted to the Sensory Log product.

## Customer flow

Purchase on Gumroad
→ customer receives an access link
→ link opens Sensory Log with `?access=...`
→ access key is validated
→ access is remembered locally
→ key is removed from the visible URL
→ app opens normally

A customer can also paste the access key into the activation screen.

## Local-first behavior

After successful activation, the browser stores a local authorization flag. Opening the app later does not require another network request or another key.

The gate therefore does not become a dependency for:

- check-ins
- history
- patterns
- regulation
- personal manual
- exports
- offline use

## Product key

The release key lives in one clearly marked constant in `js/access-gate.js`:

`VALID_ACCESS_KEY`

The real production key has intentionally not been invented or committed here because it was not supplied.

## Important security boundary

This is a client-side access gate, not server-side cryptographic licensing. A determined user who can modify browser code can bypass it. That is an intentional tradeoff for this release model, matching the requested PaimonVault-style deployment.

Do not describe this gate as server-enforced ownership verification.

## Admin tooling

No admin dashboard is part of Sensory Log.

License/key generation, purchase management, revocation, analytics, and other administrative operations will live in a separate application later.

## Purchase destination

The current gate points to the Sensory Log/Gumroad store entry point. Replace the purchase URL with the exact product URL once the final product page is available.
