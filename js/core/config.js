/**
 * Public runtime configuration only.
 * Secrets must never be placed here.
 */
export const APP_CONFIG = Object.freeze({
  product: "sensory-log",
  dataVersion: 5,
  firebaseProjectId: "",
  ai: {
    puterOptional: true,
    geminiViaFirebaseAiLogic: true,
    clientSideApiKeysAllowed: false
  },
  license: {
    provider: "firebase",
    activationRequired: true
  }
});
