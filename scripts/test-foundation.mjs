import assert from "node:assert/strict";
import {
  DATA_VERSION,
  blankEntry,
  normalizeEntry,
  normalizeEntries,
  validateImportPayload
} from "../js/core/schema.js";

assert.equal(typeof DATA_VERSION, "number");

const blank = blankEntry("2026-09-27");
assert.equal(blank.date, "2026-09-27");
assert.deepEqual(blank.body, []);

const normalized = normalizeEntry({
  date: "2026-09-27",
  energy: 99,
  overwhelm: -4,
  masking: 2,
  sleepHours: 30,
  body: ["noise", "noise", "", 7],
  note: "  hello  "
});

assert.equal(normalized.energy, 5);
assert.equal(normalized.overwhelm, 0);
assert.equal(normalized.sleepHours, 24);
assert.deepEqual(normalized.body, ["noise"]);
assert.equal(normalized.note, "hello");

assert.equal(normalizeEntry({ date: "2026-02-30" }), null);
assert.equal(normalizeEntry({ date: "not-a-date" }), null);

const deduped = normalizeEntries([
  { date: "2026-09-27", energy: 1 },
  { date: "2026-09-26", energy: 3 },
  { date: "2026-09-27", energy: 4 }
]);

assert.equal(deduped.length, 2);
assert.equal(deduped[1].energy, 4);
assert.equal(deduped[0].date, "2026-09-26");

const validImport = validateImportPayload({
  format: "sensory-log-backup",
  version: 1,
  entries: [{ date: "2026-09-27", energy: 2 }]
});

assert.equal(validImport.ok, true);
assert.equal(validImport.entries.length, 1);

assert.equal(validateImportPayload({}).ok, false);

console.log("Phase A schema checks passed.");
