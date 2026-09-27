/**
 * Public runtime configuration only.
 * Firebase web config and reCAPTCHA Enterprise site keys are public browser
 * configuration. Secrets must never be placed here.
 */
export const APP_CONFIG = Object.freeze({
  product: "sensory-log",
  dataVersion: 5,
  firebaseProjectId: "sensorylog-3d630",
  ai: {
    puterOptional: true,
    geminiViaFirebaseAiLogic: true,
    clientSideApiKeysAllowed: false
  },
  license: {
    provider: "firebase",
    activationRequired: true,
    offlineGraceDays: 14,
    serverVerification: true
  }
});
