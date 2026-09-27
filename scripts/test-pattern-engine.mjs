import assert from "node:assert/strict";
import { baselineProfile, signalRelationships, recurringSignatures, recoveryCurves, trendProfile, buildPatternIntelligence } from "../js/core/pattern-engine.js";

const entries=[];
for(let i=1;i<=12;i++){
  const day=String(i).padStart(2,"0");
  entries.push({
    date:`2026-09-${day}`,
    energy:i<=6?4:2,
    overwhelm:i<=6?2:4,
    recovery:i<=6?1:4,
    sleepQuality:i<=6?5:1,
    socialBattery:i<=6?4:2,
    masking:i<=6?0:2,
    drains:i<=6?[]:["noise","social"],
    helped:i<=6?["quiet"]:[],
  });
}

const baseline=baselineProfile(entries);
assert.equal(baseline.sampleDays,12);
assert.equal(baseline.fields.energy.sampleSize,12);

const relationships=signalRelationships(entries);
assert.ok(relationships.some(x=>x.id==="sleep-next-energy"));
assert.ok(relationships.every(x=>x.nA>=3&&x.nB>=3));

const signatures=recurringSignatures(entries);
assert.ok(signatures.some(x=>x.value==="noise"));

const recovery=recoveryCurves(entries);
assert.equal(recovery.sampleSize,11);
assert.ok(recovery.groups.high.sampleSize>0);

const trends=trendProfile(entries);
assert.equal(trends.window,12);
assert.equal(trends.trends.energy.difference,-2);

const intelligence=buildPatternIntelligence(entries);
assert.equal(intelligence.version,1);
assert.equal(intelligence.sampleDays,12);
assert.ok(Array.isArray(intelligence.relationships));

const sparse=buildPatternIntelligence(entries.slice(0,2));
assert.equal(sparse.relationships.length,0);
assert.equal(sparse.signatures.length,0);
console.log("Phase E pattern intelligence checks passed.");
