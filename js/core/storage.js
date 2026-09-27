/**
 * Sensory Log — canonical local-first storage adapter.
 * IndexedDB is the primary store; localStorage remains a compatibility/fallback
 * layer for existing installations and browsers where IndexedDB is unavailable.
 *
 * Feature modules should use this module instead of creating new persistence
 * mechanisms. Network services must never be required to read the local core log.
 */
import { DATA_VERSION, STORAGE_KEYS, normalizeEntries } from "./schema.js";

const DB_NAME = "sensory-log";
const DB_VERSION = 1;
const STORE = "kv";
const ENTRY_KEY = "entries";
const META_KEY = "meta";

function hasIndexedDB() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function hasLocalStorage() {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) return reject(new Error("IndexedDB unavailable"));

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local database"));
  });
}

async function idbGet(key) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not read local data"));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Could not read local data"));
    };
  });
}

async function idbPut(key, value) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Could not save local data"));
    };

    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("Could not save local data"));
    };
  });
}

async function idbDelete(key) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Could not remove local data"));
    };

    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("Could not remove local data"));
    };
  });
}

function legacyRead() {
  if (!hasLocalStorage()) return [];

  try {
    const raw =
      localStorage.getItem(STORAGE_KEYS.entries) ||
      localStorage.getItem("sensoryLogEntries_v2") ||
      localStorage.getItem("sensoryLogEntries");

    return raw ? normalizeEntries(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function legacyWriteEntries(entries) {
  if (!hasLocalStorage()) throw new Error("localStorage unavailable");
  localStorage.setItem(STORAGE_KEYS.entries, JSON.stringify(normalizeEntries(entries)));
}

export async function getLocal(key, fallback = null) {
  try {
    const value = await idbGet(key);
    return value === undefined ? fallback : value;
  } catch {
    if (!hasLocalStorage()) return fallback;

    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
}

export async function setLocal(key, value) {
  try {
    await idbPut(key, value);
    return { ok: true, backend: "indexeddb" };
  } catch {
    try {
      if (!hasLocalStorage()) throw new Error("No local storage backend available");
      localStorage.setItem(key, JSON.stringify(value));
      return { ok: true, backend: "localstorage" };
    } catch {
      return { ok: false, backend: "none", error: "Local storage is unavailable." };
    }
  }
}

export async function removeLocal(key) {
  try {
    await idbDelete(key);
    return { ok: true, backend: "indexeddb" };
  } catch {
    try {
      if (!hasLocalStorage()) throw new Error("No local storage backend available");
      localStorage.removeItem(key);
      return { ok: true, backend: "localstorage" };
    } catch {
      return { ok: false, backend: "none", error: "Local storage is unavailable." };
    }
  }
}

export async function getEntries() {
  const legacy = legacyRead();

  try {
    const value = await idbGet(ENTRY_KEY);
    const indexed = value ? normalizeEntries(value) : [];

    if (!legacy.length) return indexed;
    if (!indexed.length) return legacy;

    // IndexedDB is the current write target. It is intentionally appended last
    // so a legacy copy can never overwrite the newer IndexedDB value for a date.
    return normalizeEntries([...legacy, ...indexed]);
  } catch {
    return legacy;
  }
}

export async function saveEntries(entries) {
  const normalized = normalizeEntries(entries);

  try {
    await idbPut(ENTRY_KEY, normalized);
    await idbPut(META_KEY, {
      dataVersion: DATA_VERSION,
      savedAt: new Date().toISOString()
    });
    return { ok: true, entries: normalized, backend: "indexeddb" };
  } catch {
    try {
      legacyWriteEntries(normalized);
      return { ok: true, entries: normalized, backend: "localstorage" };
    } catch {
      return {
        ok: false,
        entries: normalized,
        backend: "none",
        error: "Local storage is unavailable."
      };
    }
  }
}

export async function getStorageInfo() {
  let indexeddb = false;
  let localstorage = false;
  let dataVersion = null;

  try {
    indexeddb = hasIndexedDB();
    if (indexeddb) {
      const meta = await idbGet(META_KEY);
      dataVersion = Number.isFinite(Number(meta?.dataVersion))
        ? Number(meta.dataVersion)
        : null;
    }
  } catch {}

  localstorage = hasLocalStorage();

  return Object.freeze({
    primary: indexeddb ? "indexeddb" : "localstorage",
    indexeddb,
    localstorage,
    dataVersion,
    offlineCapable: indexeddb || localstorage
  });
}

export async function migrateLegacyEntries() {
  const legacy = legacyRead();

  try {
    const indexed = normalizeEntries(await idbGet(ENTRY_KEY) || []);

    if (!legacy.length) {
      return { migrated: 0, entries: indexed, source: "indexeddb" };
    }

    const merged = normalizeEntries([...legacy, ...indexed]);

    // Only write when there is legacy data. The legacy copy is deliberately
    // retained as a backwards-compatible safety net.
    await idbPut(ENTRY_KEY, merged);
    await idbPut(META_KEY, {
      dataVersion: DATA_VERSION,
      migratedAt: new Date().toISOString(),
      migratedEntries: legacy.length
    });

    return {
      migrated: legacy.length,
      entries: merged,
      source: "legacy-localstorage"
    };
  } catch {
    return {
      migrated: 0,
      entries: normalizeEntries(legacy),
      source: legacy.length ? "localstorage-fallback" : "none"
    };
  }
}
