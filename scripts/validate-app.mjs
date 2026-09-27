#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function parseJson(path) {
  try {
    return JSON.parse(read(path));
  } catch (error) {
    fail(`${path}: invalid JSON (${error.message})`);
    return null;
  }
}

for (const path of [
  "index.html",
  "firebase.json",
  "firestore.rules",
  "manifest.webmanifest",
]) {
  if (!existsSync(resolve(root, path))) fail(`missing required file: ${path}`);
}

const firebase = parseJson("firebase.json");
if (firebase) {
  if (firebase.hosting?.public !== ".") {
    fail("firebase.json: Hosting public root must remain '.'");
  }
  if (firebase.storage) {
    fail("firebase.json: Firebase Storage configuration is not allowed");
  }
  if (!firebase.firestore?.rules) {
    fail("firebase.json: Firestore rules configuration is missing");
  }
}

const manifest = parseJson("manifest.webmanifest");
if (manifest) {
  for (const field of ["name", "short_name", "start_url", "display"]) {
    if (!manifest[field]) fail(`manifest.webmanifest: missing ${field}`);
  }
}

for (const path of ["signal-feed.json", "signal-policy.json", "signal-sources.json"]) {
  if (existsSync(resolve(root, path))) parseJson(path);
}

const html = read("index.html");

if (/maximum-scale\s*=/.test(html)) {
  fail("index.html: viewport must not disable user zoom");
}

if (/src=["']\.\/js\/app\.js["']/.test(html)) {
  fail("index.html: legacy js/app.js runtime is still referenced");
}

for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
  const reference = match[1];
  if (
    reference.startsWith("#") ||
    reference.startsWith("http://") ||
    reference.startsWith("https://") ||
    reference.startsWith("data:") ||
    reference.startsWith("mailto:")
  ) continue;

  const clean = reference.split(/[?#]/, 1)[0];
  const target = resolve(root, clean);
  if (!target.startsWith(root) || !existsSync(target)) {
    fail(`index.html: referenced local asset does not exist: ${reference}`);
  }
}

for (const [path, needle, label] of [
  ["js", "prompt(", "legacy prompt() interaction"],
  ["js", "MutationObserver", "legacy MutationObserver runtime"],
]) {
  const directory = resolve(root, path);
  if (!existsSync(directory)) continue;
  const entries = readFileSync;
  const files = [
    "ai-ui.js", "ai.js", "app-shell.js", "backup.js", "checkin.js",
    "history.js", "home.js", "manual.js", "onboarding.js", "patterns.js",
    "preferences.js", "regulation.js", "reports.js", "signal-data.js", "signal.js",
  ];
  for (const file of files) {
    const filePath = resolve(directory, file);
    if (existsSync(filePath) && entries(filePath, "utf8").includes(needle)) {
      fail(`js/${file}: ${label}`);
    }
  }
}

if (existsSync(resolve(root, "storage.rules"))) {
  fail("storage.rules must not return while Firebase Storage is disabled");
}

if (failures.length) {
  console.error("Sensory Log validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Sensory Log static integrity checks passed.");
