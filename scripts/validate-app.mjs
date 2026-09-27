#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function parseJson(path) {
  try {
    return JSON.parse(read(path));
  } catch (error) {
    fail(`${path}: invalid JSON (${error.message})`);
    return null;
  }
}

function walk(dir, predicate) {
  const output = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) output.push(...walk(path, predicate));
    else if (predicate(path)) output.push(path);
  }
  return output;
}

const required = [
  "index.html",
  "firebase.json",
  "firestore.rules",
  "manifest.webmanifest",
];

for (const path of required) {
  if (!existsSync(join(root, path))) fail(`missing required file: ${path}`);
}

const firebase = parseJson("firebase.json");
if (firebase) {
  if (firebase.hosting?.public !== ".") {
    fail("firebase.json: Hosting public root must remain '.' for this static app");
  }
  if (firebase.storage) {
    fail("firebase.json: Firebase Storage configuration is not allowed in this product");
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
  if (existsSync(join(root, path))) parseJson(path);
}

const html = read("index.html");

if (/maximum-scale\s*=/.test(html)) {
  fail("index.html: viewport must not disable user zoom");
}

if (/src=["']\.\/js\/app\.js["']/.test(html)) {
  fail("index.html: legacy js/app.js runtime is still referenced");
}

const localReferences = [
  ...[...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1]),
];

for (const reference of localReferences) {
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

const jsFiles = walk(join(root, "js"), (path) => path.endsWith(".js"));
for (const absolutePath of jsFiles) {
  const relativePath = relative(root, absolutePath);
  try {
    execFileSync(process.execPath, ["--check", absolutePath], {
      stdio: "pipe",
    });
  } catch (error) {
    fail(`${relativePath}: JavaScript syntax check failed`);
  }

  const source = readFileSync(absolutePath, "utf8");
  const imports = [
    ...source.matchAll(/(?:from|import)\s*["'](\.\.?\/[^"']+)["']/g),
  ];

  for (const match of imports) {
    const importPath = match[1].split(/[?#]/, 1)[0];
    const resolved = resolve(absolutePath, "..", importPath);
    const candidates = [
      resolved,
      `${resolved}.js`,
      join(resolved, "index.js"),
    ];
    if (!candidates.some(existsSync)) {
      fail(`${relativePath}: local import does not resolve: ${importPath}`);
    }
  }
}

const forbidden = [
  ["prompt(", "legacy prompt() interaction"],
  ["MutationObserver", "legacy MutationObserver runtime"],
];

for (const [needle, label] of forbidden) {
  for (const absolutePath of jsFiles) {
    const source = readFileSync(absolutePath, "utf8");
    if (source.includes(needle)) fail(`${relative(root, absolutePath)}: ${label}`);
  }
}

if (existsSync(join(root, "storage.rules"))) {
  fail("storage.rules must not return while Firebase Storage is intentionally disabled");
}

if (failures.length) {
  console.error("Sensory Log validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Sensory Log validation passed: ${jsFiles.length} JavaScript modules checked.`);
