/**
 * Phase A bootstrap diagnostics. Safe to import from the new app shell.
 */
import { localDateString } from "./date.js";
import { migrateLegacyEntries } from "./storage.js";

export async function initializeFoundation() {
  const result = await migrateLegacyEntries();
  return {
    ok: true,
    date: localDateString(),
    storage: result,
    capabilities: {
      indexedDB: "indexedDB" in window,
      serviceWorker: "serviceWorker" in navigator,
      crypto: !!globalThis.crypto?.subtle,
      online: navigator.onLine
    }
  };
}

export function reportFoundationError(error) {
  console.error("[Sensory Log]", error);
  window.dispatchEvent(new CustomEvent("sensory-log:error", {
    detail: { message: error instanceof Error ? error.message : String(error) }
  }));
}
