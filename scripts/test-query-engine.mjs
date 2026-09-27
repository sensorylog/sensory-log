import assert from "node:assert/strict";
import { executeQuery, normalizeQuery } from "../js/core/query-engine.js";
const entries=[
 {date:"2026-09-01",energy:2,overwhelm:4,recovery:4,socialBattery:2,masking:2,helped:["quiet"],drains:["crowds"]},
 {date:"2026-09-02",energy:3,overwhelm:2,recovery:2,socialBattery:3,masking:1,helped:["quiet"],drains:["noise"]},
 {date:"2026-09-03",energy:4,overwhelm:1,recovery:1,socialBattery:4,masking:0,helped:["walk"],drains:["crowds"]},
 {date:"2026-09-04",energy:2,overwhelm:4,recovery:4,socialBattery:2,masking:2,helped:["quiet"],drains:["crowds"]}
];
assert.equal(normalizeQuery({intent:"helpful",days:7}).intent,"helpful");
assert.equal(normalizeQuery({intent:"nope",days:999}).intent,"summary");
const helpful=executeQuery(entries,{}, {intent:"helpful",days:7});
assert.match(helpful.result.facts[0],/quiet/);
const relationship=executeQuery(entries,{}, {intent:"relationship",days:7});
assert.ok(Array.isArray(relationship.result.facts));
assert.equal(relationship.provenance.sampleDays,4);
console.log("Phase I query engine checks passed.");
