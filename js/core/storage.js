/**
 * Sensory Log — resilient local-first storage.
 * IndexedDB is the future primary store; the v1 bridge below preserves the
 * original localStorage dataset until the new UI adopts this module.
 */
import { DATA_VERSION, STORAGE_KEYS, normalizeEntries } from "./schema.js";

const DB_NAME = "sensory-log";
const DB_VERSION = 1;
const STORE = "kv";

function openDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("IndexedDB unavailable"));
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
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbPut(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("Could not save local data")); };
  });
}

function legacyRead() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.entries) ||
      localStorage.getItem("sensoryLogEntries_v2") ||
      localStorage.getItem("sensoryLogEntries");
    return raw ? normalizeEntries(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export async function getEntries() {
  const legacy = legacyRead();
  try {
    const value = await idbGet("entries");
    const indexed = value ? normalizeEntries(value) : [];
    if (!legacy.length) return indexed;
    if (!indexed.length) return legacy;
    // The legacy UI still writes localStorage during the transition. Merge by
    // date so a newly saved day cannot be hidden behind an older IndexedDB copy.
    return normalizeEntries([...indexed, ...legacy]);
  } catch {
    return legacy;
  }
}

export async function saveEntries(entries) {
  const normalized = normalizeEntries(entries);
  try {
    await idbPut("entries", normalized);
    await idbPut("meta", { dataVersion: DATA_VERSION, migratedAt: new Date().toISOString() });
    return { ok: true, entries: normalized, backend: "indexeddb" };
  } catch {
    try {
      localStorage.setItem(STORAGE_KEYS.entries, JSON.stringify(normalized));
      return { ok: true, entries: normalized, backend: "localstorage" };
    } catch {
      return { ok: false, entries: normalized, backend: "none", error: "Local storage is unavailable." };
    }
  }
}

export async function migrateLegacyEntries() {
  const existing = await getEntries();
  if (!existing.length) return { migrated: 0, entries: [] };
  try { await idbPut("entries", existing); } catch {}
  return { migrated: existing.length, entries: existing };
}
