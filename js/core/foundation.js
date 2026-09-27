/**
 * Sensory Log — Phase A bootstrap diagnostics.
 * Safe to import from the app shell. This module has no UI/network dependency.
 */
import { localDateString } from "./date.js";
import { getStorageInfo, migrateLegacyEntries } from "./storage.js";
import { DATA_VERSION } from "./schema.js";

export async function initializeFoundation() {
  const migration = await migrateLegacyEntries();
  const storage = await getStorageInfo();

  return {
    ok: storage.offlineCapable,
    date: localDateString(),
    dataVersion: DATA_VERSION,
    storage,
    migration,
    capabilities: {
      indexedDB: typeof window !== "undefined" && "indexedDB" in window,
      serviceWorker: typeof navigator !== "undefined" && "serviceWorker" in navigator,
      crypto: !!globalThis.crypto?.subtle,
      online: typeof navigator !== "undefined" ? navigator.onLine : false
    }
  };
}

export function reportFoundationError(error) {
  console.error("[Sensory Log]", error);
  window.dispatchEvent(new CustomEvent("sensory-log:error", {
    detail: {
      message: error instanceof Error ? error.message : String(error)
    }
  }));
}
