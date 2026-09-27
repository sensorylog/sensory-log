import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../js/checkin.js", import.meta.url), "utf8");

assert.match(source, /class="save quick-save"/);
assert.match(source, /async function saveQuick\(\)/);
assert.match(source, /Low-capacity mode/);
assert.match(source, /Everything else can wait/);
assert.match(source, /normalizeEntry\(/);
assert.match(source, /saveEntries\(/);
assert.match(source, /sensory-log:entries-changed/);
assert.doesNotMatch(source, /fetch\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);

console.log("Phase D check-in contract checks passed.");
