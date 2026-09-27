/**
 * Sensory Log — Phase G personal operating manual engine.
 * Explicit preferences belong to the person. Historical observations are evidence only.
 */
const unique = values => [...new Set((Array.isArray(values) ? values : [])
  .map(value => String(value ?? "").trim()).filter(Boolean))].slice(0, 30);

export const MANUAL_VERSION = 1;
export const DEFAULT_MANUAL = Object.freeze({
  version: MANUAL_VERSION,
  sensory: { preferences: [], reduce: [], helpfulInputs: [] },
  masking: { situations: [], strategies: [] },
  communication: { preferred: [], avoid: [], scripts: [] },
  accommodations: [],
  strengths: [],
  preferences: [],
  notes: ""
});

export function normalizeManual(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const accommodation = item => {
    if (!item || typeof item !== "object") return null;
    const need = String(item.need ?? "").trim().slice(0, 120);
    const request = String(item.request ?? "").trim().slice(0, 300);
    return need && request ? { need, request } : null;
  };
  return {
    version: MANUAL_VERSION,
    sensory: {
      preferences: unique(source.sensory?.preferences),
      reduce: unique(source.sensory?.reduce),
      helpfulInputs: unique(source.sensory?.helpfulInputs)
    },
    masking: {
      situations: unique(source.masking?.situations),
      strategies: unique(source.masking?.strategies)
    },
    communication: {
      preferred: unique(source.communication?.preferred),
      avoid: unique(source.communication?.avoid),
      scripts: unique(source.communication?.scripts)
    },
    accommodations: (Array.isArray(source.accommodations) ? source.accommodations : [])
      .map(accommodation).filter(Boolean).slice(0, 20),
    strengths: unique(source.strengths),
    preferences: unique(source.preferences),
    notes: String(source.notes ?? "").trim().slice(0, 1000)
  };
}

function evidenceFromEntries(entries = []) {
  const source = Array.isArray(entries) ? entries : [];
  const count = values => values.reduce((map, value) => {
    const key = String(value ?? "").trim();
    if (key) map[key] = (map[key] || 0) + 1;
    return map;
  }, {});
  const top = (field, limit = 5) => Object.entries(count(
    source.flatMap(entry => Array.isArray(entry?.[field]) ? entry[field] : [])
  )).sort((a,b) => b[1] - a[1]).slice(0, limit)
    .map(([label, days]) => ({ label, days }));
  return { helpful: top("helped"), drains: top("drains"), body: top("body"), days: source.length };
}

export function buildPersonalModel(manual = DEFAULT_MANUAL, entries = []) {
  const declared = normalizeManual(manual);
  return Object.freeze({
    version: MANUAL_VERSION,
    declared: Object.freeze(declared),
    evidence: Object.freeze(evidenceFromEntries(entries)),
    boundaries: Object.freeze({
      strengthsAreDeclared: true,
      preferencesAreDeclared: true,
      evidenceIsDescriptive: true
    })
  });
}
