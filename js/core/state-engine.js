/**
 * Sensory Log — Phase C state engine.
 *
 * Raw entries remain the source of truth. This module derives a current state
 * without mutating or replacing those observations.
 *
 * Pipeline:
 * raw observations -> normalized signals -> current state -> needs
 */

const clamp = (value, min = 0, max = 5) =>
  Math.min(max, Math.max(min, Number(value)));

const finite = value => value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;

const average = values => {
  const valid = values.map(finite).filter(value => value !== null);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};

const round = (value, digits = 1) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function signal(value, source = "check-in") {
  const numeric = finite(value);
  return numeric === null ? null : {
    value: clamp(numeric),
    source
  };
}

function baselineFor(entries, field, currentDate, window = 7) {
  const prior = entries
    .filter(entry => entry?.date && entry.date < currentDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-window);

  const values = prior.map(entry => entry?.[field]);
  const mean = average(values);

  return {
    value: mean === null ? null : round(mean),
    sampleSize: values.map(finite).filter(value => value !== null).length,
    window
  };
}

function deriveLoads(entry) {
  const sensoryLoad = finite(entry?.overwhelm);
  const socialLoad = finite(entry?.socialBattery) === null
    ? null
    : 5 - clamp(entry.socialBattery);
  const maskingLoad = finite(entry?.masking) === null
    ? null
    : clamp((entry.masking / 3) * 5);

  // Cognitive load is intentionally null until a direct observation exists.
  // We do not invent a cognitive signal from unrelated fields.
  return Object.freeze({
    sensory: sensoryLoad === null ? null : clamp(sensoryLoad),
    social: socialLoad === null ? null : clamp(socialLoad),
    cognitive: null,
    masking: maskingLoad,
    recoveryNeed: finite(entry?.recovery) === null ? null : clamp(entry.recovery)
  });
}

function deriveCapacity(entry, loads) {
  const contributors = [];

  const energy = finite(entry?.energy);
  if (energy !== null && energy > 0) contributors.push(clamp(energy));

  if (loads.sensory !== null && energy > 0) {
    contributors.push(5 - loads.sensory);
  }

  if (loads.social !== null && energy > 0) {
    contributors.push(5 - loads.social);
  }

  if (loads.recoveryNeed !== null && energy > 0) {
    contributors.push(5 - loads.recoveryNeed);
  }

  if (loads.masking !== null && energy > 0) {
    contributors.push(5 - loads.masking);
  }

  if (!contributors.length) return null;
  return round(average(contributors));
}

function deriveNeeds(entry, loads, capacity) {
  const needs = [];

  if (!entry || !finite(entry.energy)) {
    needs.push({
      id: "observe",
      label: "Notice first",
      reason: "There is not enough current information to derive a useful state yet."
    });
    return needs;
  }

  if (loads.sensory !== null && loads.sensory >= 4) {
    needs.push({
      id: "less-input",
      label: "Less input",
      reason: "Sensory load is currently high."
    });
  }

  if (capacity !== null && capacity <= 2) {
    needs.push({
      id: "lower-demand",
      label: "Lower the demand",
      reason: "Available capacity is currently low."
    });
  }

  if (loads.recoveryNeed !== null && loads.recoveryNeed >= 4) {
    needs.push({
      id: "recovery-space",
      label: "Recovery space",
      reason: "Recovery need is currently high."
    });
  }

  if (loads.social !== null && loads.social >= 4) {
    needs.push({
      id: "social-space",
      label: "Social space",
      reason: "Social battery is currently low."
    });
  }

  if (loads.masking !== null && loads.masking >= 3.34) {
    needs.push({
      id: "less-performance",
      label: "Less performance",
      reason: "Masking load is currently elevated."
    });
  }

  if (!needs.length) {
    needs.push({
      id: "observe",
      label: "Keep observing",
      reason: "Current signals do not point to one dominant need."
    });
  }

  return needs;
}

function confidenceFor(entry, loads, baseline) {
  const observed = [
    finite(entry?.energy),
    loads.sensory,
    finite(entry?.recovery),
    finite(entry?.socialBattery),
    finite(entry?.sleepQuality),
    loads.masking
  ].filter(value => value !== null).length;

  const signalConfidence = observed / 6;
  const baselineConfidence = Math.min(1, (baseline?.energy?.sampleSize || 0) / 7);

  return round((signalConfidence * 0.7) + (baselineConfidence * 0.3), 2);
}

export function deriveState(entries = [], currentDate) {
  const source = Array.isArray(entries) ? entries.filter(Boolean) : [];
  const dates = source.map(entry => entry?.date).filter(Boolean).sort();
  const date = currentDate || dates.at(-1) || null;
  const entry = source.find(item => item.date === date) || null;

  if (!entry) {
    return Object.freeze({
      date,
      capacity: null,
      capacityDelta: null,
      loads: Object.freeze({
        sensory: null,
        social: null,
        cognitive: null,
        masking: null,
        recoveryNeed: null
      }),
      recovery: null,
      baseline: Object.freeze({
        energy: { value: null, sampleSize: 0, window: 7 },
        sensory: { value: null, sampleSize: 0, window: 7 },
        socialBattery: { value: null, sampleSize: 0, window: 7 }
      }),
      confidence: 0,
      needs: deriveNeeds(null, {}, null)
    });
  }

  const loads = deriveLoads(entry);
  const capacity = deriveCapacity(entry, loads);
  const baseline = {
    energy: baselineFor(source, "energy", date),
    sensory: baselineFor(source, "overwhelm", date),
    socialBattery: baselineFor(source, "socialBattery", date)
  };

  const energy = finite(entry.energy);
  const capacityDelta = capacity !== null && baseline.energy.value !== null
    ? round(capacity - baseline.energy.value)
    : null;

  const state = {
    date,
    capacity,
    capacityDelta,
    loads,
    recovery: loads.recoveryNeed,
    baseline,
    confidence: confidenceFor(entry, loads, baseline),
    needs: deriveNeeds(entry, loads, capacity)
  };

  return Object.freeze(state);
}

export function summarizeState(state) {
  if (!state) return "No current state.";

  const capacity = state.capacity === null ? "unknown" : `${state.capacity.toFixed(1)}/5`;
  const need = state.needs?.[0]?.label || "Keep observing";

  return `Capacity ${capacity}. Current need: ${need}.`;
}

export const STATE_ENGINE_VERSION = 1;
