import assert from "node:assert/strict";
import { DEFAULT_MANUAL, normalizeManual, buildPersonalModel } from "../js/core/manual-engine.js";

const manual = normalizeManual({
  sensory: { preferences: ["quiet", "quiet"], reduce: ["bright light"] },
  masking: { situations: ["large groups"] },
  communication: { preferred: ["written"], scripts: ["I need a quieter space."] },
  accommodations: [{ need: "noise", request: "Please use a quieter room." }],
  strengths: ["deep focus"],
  preferences: ["predictable plans"]
});

assert.deepEqual(manual.sensory.preferences, ["quiet"]);
assert.equal(manual.accommodations.length, 1);
assert.equal(manual.strengths[0], "deep focus");

const model = buildPersonalModel(manual, [
  { date: "2026-01-01", helped: ["quiet"], drains: ["crowds"], body: ["jaw tension"] }
]);
assert.equal(model.declared.preferences[0], "predictable plans");
assert.equal(model.evidence.helpful[0].label, "quiet");
assert.equal(model.boundaries.strengthsAreDeclared, true);
assert.equal(model.boundaries.evidenceIsDescriptive, true);

const empty = normalizeManual(DEFAULT_MANUAL);
assert.deepEqual(empty.accommodations, []);
console.log("Phase G personal manual engine checks passed.");
