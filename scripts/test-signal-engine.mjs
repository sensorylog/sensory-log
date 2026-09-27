import assert from "node:assert/strict";
import { normalizeSignalItem, normalizeSignalFeed, personalizeSignal } from "../js/core/signal-engine.js";

const base={id:"a",type:"Research",date:"2026-09-01",title:"Noise and focus",text:"Quiet environments can matter.",source:"Example",sourceUrl:"https://example.com/a",note:"Study summary",evidence:"primary",topics:["noise","focus"]};
assert.equal(normalizeSignalItem(base).evidence,"primary");
assert.equal(normalizeSignalItem({...base,sourceUrl:"http://example.com"}),null);
assert.equal(normalizeSignalFeed([base,{...base,id:"a"},{...base,id:"b",date:"2026-09-02"}]).length,2);
const ordered=personalizeSignal([
  {...base,id:"x",title:"Other topic",text:"Another subject entirely.",date:"2026-09-03",topics:["other"]},
  {...base,id:"y",title:"Quiet rooms",date:"2026-09-01",topics:["quiet"]}
],{sensory:{preferences:["quiet"]}});
assert.equal(ordered[0].id,"y");
console.log("Phase H Signal engine checks passed.");
