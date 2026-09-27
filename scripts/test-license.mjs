import fs from "node:fs";
import assert from "node:assert/strict";

const index = fs.readFileSync("index.html", "utf8");
const firebase = fs.readFileSync("js/core/firebase.js", "utf8");
const license = fs.readFileSync("js/license.js", "utf8");
const worker = fs.readFileSync("license-worker/src/index.js", "utf8");
const rules = fs.readFileSync("firestore.rules", "utf8");

assert(!index.includes("access-gate.js"));
assert(!index.includes("access-gate.css"));
assert(index.includes("styles/license.css"));
assert(firebase.includes("getAuth"));
assert(!firebase.includes("getFunctions"));
assert(license.includes("activateLicense"));
assert(license.includes("waitForLicense"));
assert(worker.includes("api.gumroad.com/v2/licenses/verify"));
assert(worker.includes("FIREBASE_SERVICE_ACCOUNT_JSON"));
assert(worker.includes("identitytoolkit.googleapis.com/v1/accounts:lookup"));
assert(rules.includes("request.auth.uid == userId"));
assert(rules.includes("allow write: if false"));

console.log("Phase L Firebase licensing contract valid.");
