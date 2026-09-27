/**
 * Sensory Log — Phase A data contract.
 * Pure validation/normalization. No UI, network, Firebase, or AI dependencies.
 */
export const DATA_VERSION = 5;
export const STORAGE_KEYS = Object.freeze({
  entries: "sensoryLog_v3",
  settings: "sensoryLogSettings_v1",
  theme: "sensoryTheme",
  foundation: "sensoryLogFoundation_v1"
});

const ARRAY_FIELDS = ["body", "mood", "drains", "helped"];
const NUMBER_FIELDS = ["energy", "overwhelm", "masking", "recovery", "sleepHours", "sleepQuality", "socialBattery", "meltdown"];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const cleanString = (value, max = 2000) => typeof value === "string" ? value.trim().slice(0, max) : "";

function validDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
}

export function blankEntry(date) {
  return {
    date,
    energy: 0,
    overwhelm: 0,
    masking: null,
    body: [],
    mood: [],
    drains: [],
    env: null,
    meltdown: null,
    sleepHours: null,
    sleepQuality: 0,
    socialBattery: 0,
    recovery: 0,
    helped: [],
    note: ""
  };
}

export function normalizeEntry(input) {
  if (!input || typeof input !== "object") return null;
  const date = validDateString(input.date) ? input.date : null;
  if (!date) return null;

  const out = blankEntry(date);
  out.energy = clamp(finite(input.energy) ?? 0, 0, 5);
  out.overwhelm = clamp(finite(input.overwhelm) ?? 0, 0, 5);
  out.masking = input.masking == null ? null : clamp(finite(input.masking) ?? 0, 0, 3);
  out.recovery = clamp(finite(input.recovery) ?? 0, 0, 5);
  out.sleepQuality = clamp(finite(input.sleepQuality) ?? 0, 0, 5);
  out.socialBattery = clamp(finite(input.socialBattery) ?? 0, 0, 5);
  out.meltdown = input.meltdown == null ? null : clamp(finite(input.meltdown) ?? 0, 0, 2);
  const sleepHours = input.sleepHours === "" || input.sleepHours == null ? null : finite(input.sleepHours);
  out.sleepHours = sleepHours == null ? null : clamp(sleepHours, 0, 24);
  out.env = typeof input.env === "string" ? input.env.trim().slice(0, 100) || null : null;

  for (const field of ARRAY_FIELDS) {
    const values = Array.isArray(input[field]) ? input[field] : [];
    out[field] = [...new Set(values.filter(v => typeof v === "string").map(v => v.trim()).filter(Boolean).slice(0, 100))].slice(0, 40);
  }
  out.note = cleanString(input.note);
  return out;
}

export function normalizeEntries(value) {
  const source = Array.isArray(value) ? value : (Array.isArray(value?.entries) ? value.entries : []);
  const byDate = new Map();
  for (const item of source) {
    const normalized = normalizeEntry(item);
    if (normalized) byDate.set(normalized.date, normalized);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function validateImportPayload(value) {
  const source = Array.isArray(value) ? value : value?.entries;
  if (!Array.isArray(source)) return { ok: false, error: "The backup does not contain an entries array." };
  const entries = normalizeEntries(source);
  if (!entries.length && source.length) return { ok: false, error: "No valid entries were found in the backup." };
  return { ok: true, entries };
}