import assert from "node:assert/strict";
import fs from "node:fs";

const gate = fs.readFileSync("js/access-gate.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles/access-gate.css", "utf8");

assert.match(gate, /VALID_ACCESS_KEY/);
assert.match(gate, /URLSearchParams/);
assert.match(gate, /localStorage/);
assert.match(gate, /replaceState/);
assert.match(html, /access-gate\.css/);
assert.match(html, /access-gate\.js/);
assert.match(css, /sl-access-gate/);

console.log("Phase K access gate checks passed.");
