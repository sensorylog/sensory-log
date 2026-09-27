import assert from "node:assert/strict";
import { deriveState, summarizeState, STATE_ENGINE_VERSION } from "../js/core/state-engine.js";

const entries = [
  { date:"2026-09-20", energy:4, overwhelm:2, recovery:1, socialBattery:4, masking:1, sleepQuality:4 },
  { date:"2026-09-21", energy:3, overwhelm:3, recovery:2, socialBattery:3, masking:1, sleepQuality:3 },
  { date:"2026-09-22", energy:4, overwhelm:2, recovery:1, socialBattery:4, masking:0, sleepQuality:4 },
  { date:"2026-09-23", energy:3, overwhelm:2, recovery:2, socialBattery:3, masking:1, sleepQuality:3 },
  { date:"2026-09-24", energy:4, overwhelm:1, recovery:1, socialBattery:5, masking:0, sleepQuality:5 },
  { date:"2026-09-25", energy:3, overwhelm:2, recovery:2, socialBattery:3, masking:1, sleepQuality:3 },
  { date:"2026-09-26", energy:4, overwhelm:2, recovery:1, socialBattery:4, masking:0, sleepQuality:4 },
  { date:"2026-09-27", energy:2, overwhelm:5, recovery:4, socialBattery:1, masking:3, sleepQuality:2 }
];

const state = deriveState(entries, "2026-09-27");

assert.equal(STATE_ENGINE_VERSION, 1);
assert.equal(state.date, "2026-09-27");
assert.equal(state.loads.sensory, 5);
assert.equal(state.loads.social, 4);
assert.equal(state.loads.cognitive, null);
assert.equal(state.loads.masking, 5);
assert.equal(state.recovery, 4);
assert.ok(state.capacity !== null && state.capacity >= 0 && state.capacity <= 5);
assert.equal(state.baseline.energy.sampleSize, 7);
assert.ok(state.baseline.energy.value > 0);
assert.ok(state.capacityDelta !== null);
assert.ok(state.confidence > 0 && state.confidence <= 1);
assert.equal(state.needs[0].id, "less-input");

const noData = deriveState([], "2026-09-27");
assert.equal(noData.capacity, null);
assert.equal(noData.confidence, 0);
assert.equal(noData.needs[0].id, "observe");

assert.match(summarizeState(state), /Capacity/);
assert.doesNotThrow(() => deriveState(entries));
console.log("Phase C state engine checks passed.");
