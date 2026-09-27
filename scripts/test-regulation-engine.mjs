import assert from "node:assert/strict";
import { buildRegulationPlan, deriveRegulationNeeds } from "../js/core/regulation-engine.js";

const highSensory={capacity:2,confidence:.8,loads:{sensory:5,social:2,masking:1,recoveryNeed:3}};
const plan=buildRegulationPlan(highSensory);
assert.equal(plan.primary.id,"less-input");
assert.equal(plan.primary.mode,"sensory");
assert.ok(plan.primary.actions.length>=2);
assert.ok(plan.alternatives.length>=1);

const lowSocial={capacity:3,confidence:.7,loads:{sensory:2,social:5,masking:1,recoveryNeed:1}};
assert.equal(deriveRegulationNeeds(lowSocial)[0].id,"social");

const empty={capacity:null,confidence:0,loads:{}};
assert.equal(buildRegulationPlan(empty).primary.id,"observe");
console.log("Phase F regulation engine checks passed.");
