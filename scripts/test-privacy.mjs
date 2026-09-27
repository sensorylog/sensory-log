import assert from "node:assert/strict";
import fs from "node:fs";

const privacy = fs.readFileSync("js/privacy.js", "utf8");
const storage = fs.readFileSync("js/core/storage.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");

assert.match(privacy, /clearAllLocalData/);
assert.match(privacy, /Delete all local data/);
assert.match(storage, /export async function clearAllLocalData/);
assert.match(index, /Privacy center/);
console.log("Phase K privacy checks passed.");
