/**
 * Phase H — Signal engine.
 * Deterministic, source-aware feed normalization. No user data leaves the device.
 */
export const SIGNAL_VERSION = 2;
export const EVIDENCE_LEVELS = Object.freeze(["primary","reported","perspective"]);

const CATEGORY_SET = new Set(["People","Apps","Research","Community"]);
const clean = (value, max=500) => String(value ?? "").trim().slice(0,max);

export function normalizeSignalItem(item = {}) {
  if (!item || typeof item !== "object") return null;
  const date = clean(item.date,10);
  const url = clean(item.sourceUrl,1000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!CATEGORY_SET.has(item.type)) return null;
  if (!clean(item.id,180) || !clean(item.title,180) || !clean(item.text,500) || !clean(item.source,180)) return null;
  if (!/^https:\/\//.test(url)) return null;
  const evidence = EVIDENCE_LEVELS.includes(item.evidence) ? item.evidence : "reported";
  const topics = Array.isArray(item.topics) ? [...new Set(item.topics.map(v => clean(v,50).toLowerCase()).filter(Boolean))].slice(0,8) : [];
  return Object.freeze({
    id: clean(item.id,180),
    type: item.type,
    date,
    title: clean(item.title,180),
    text: clean(item.text,500),
    source: clean(item.source,180),
    sourceUrl: url,
    note: clean(item.note,500),
    evidence,
    topics
  });
}

export function normalizeSignalFeed(items = [], limit = 24) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map(normalizeSignalItem)
    .filter(Boolean)
    .filter(item => !seen.has(item.id) && seen.add(item.id))
    .sort((a,b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export function personalizeSignal(items = [], manual = {}) {
  const terms = [
    ...(manual?.sensory?.preferences || []),
    ...(manual?.sensory?.helpfulInputs || []),
    ...(manual?.preferences || [])
  ].map(v => clean(v,80).toLowerCase()).filter(Boolean);
  if (!terms.length) return normalizeSignalFeed(items);
  return [...normalizeSignalFeed(items)].sort((a,b) => {
    const score = item => {
      const haystack = (item.title + " " + item.text + " " + item.topics.join(" ")).toLowerCase();
      return terms.reduce((n, term) => n + (haystack.includes(term) ? 1 : 0), 0);
    };
    const delta = score(b) - score(a);
    return delta || b.date.localeCompare(a.date);
  });
}
