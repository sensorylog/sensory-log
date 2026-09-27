import { getEntries, saveEntries } from "./core/storage.js";
import { validateImportPayload, normalizeEntries } from "./core/schema.js";

const MANUAL_KEY = "sensoryLogManual_v1";
const THEME_KEY = "sensoryTheme";
let root = null;

const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

function readManual() {
  try {
    const value = JSON.parse(localStorage.getItem(MANUAL_KEY) || "{}");
    return value && typeof value === "object" && value.notes && typeof value.notes === "object"
      ? { notes: value.notes }
      : { notes: {} };
  } catch {
    return { notes: {} };
  }
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return '"' + text.replace(/"/g, '""') + '"';
}

function toCsv(entries) {
  const fields = ["date","energy","overwhelm","masking","body","mood","drains","env","meltdown","sleepHours","sleepQuality","socialBattery","recovery","helped","note"];
  return [fields.join(","), ...entries.map(e => fields.map(field => csvCell(e[field])).join(","))].join("\n");
}

async function exportJson() {
  const entries = await getEntries();
  const payload = {
    format: "sensory-log-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: normalizeEntries(entries),
    manual: readManual(),
    theme: (() => { try { return localStorage.getItem(THEME_KEY) || "light"; } catch { return "light"; } })()
  };
  download("sensory-log-backup.json", JSON.stringify(payload, null, 2), "application/json");
  setStatus("Backup exported locally. Nothing was uploaded.");
}

async function exportCsv() {
  const entries = await getEntries();
  download("sensory-log-entries.csv", toCsv(entries), "text/csv;charset=utf-8");
  setStatus("CSV exported locally.");
}

function setStatus(message, error = false) {
  const el = root?.querySelector("[data-backup-status]");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("is-error", error);
}

async function importJson(file) {
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error("That backup is larger than 5 MB.");
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const result = validateImportPayload(payload);
    if (!result.ok) throw new Error(result.error);

    const current = await getEntries();
    const merged = normalizeEntries([...current, ...result.entries]);
    const saved = await saveEntries(merged);
    if (!saved.ok) throw new Error(saved.error || "Could not save the imported data.");

    if (payload?.manual?.notes && typeof payload.manual.notes === "object") {
      try {
        const existing = readManual();
        localStorage.setItem(MANUAL_KEY, JSON.stringify({
          notes: { ...existing.notes, ...payload.manual.notes }
        }));
      } catch {}
    }

    if (payload?.theme === "dark" || payload?.theme === "light") {
      try {
        localStorage.setItem(THEME_KEY, payload.theme);
        document.documentElement.setAttribute("data-theme", payload.theme);
        document.getElementById("themeBtn")?.replaceChildren();
        const button = document.getElementById("themeBtn");
        if (button) button.textContent = payload.theme === "dark" ? "◑" : "◐";
      } catch {}
    }

    window.dispatchEvent(new CustomEvent("sensory-log:entries-changed"));
    setStatus(`Imported ${result.entries.length} valid day${result.entries.length === 1 ? "" : "s"} and merged them with your existing history.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not import that backup.", true);
  }
}

function render() {
  root.innerHTML = `
    <section class="sl-backup-hero">
      <div>
        <div class="sl-backup-kicker">Your data</div>
        <h2>Keep a copy you control.</h2>
        <p>Export your history as a portable backup anytime. Imports merge by date, so existing days are not discarded.</p>
      </div>
    </section>
    <section class="sl-backup-card">
      <div class="sl-backup-actions">
        <button type="button" class="sl-backup-primary" data-backup-export>Export backup</button>
        <button type="button" data-backup-csv>Export CSV</button>
        <label class="sl-backup-import">
          <span>Import backup</span>
          <input type="file" accept=".json,application/json" data-backup-import />
        </label>
      </div>
      <p class="sl-backup-status" data-backup-status role="status" aria-live="polite"></p>
      <div class="sl-backup-note">
        <strong>Privacy note</strong>
        <span>Your backup is created in your browser and downloaded to your device. Sensory Log does not upload it as part of this backup flow.</span>
      </div>
    </section>
    <section class="sl-backup-details">
      <details>
        <summary>What is included?</summary>
        <p>Your logged days, personal operating-manual notes, and light/dark theme preference. CSV contains the logged entry fields only.</p>
      </details>
      <details>
        <summary>What does import do?</summary>
        <p>It validates the backup, normalizes entries, then merges them with your current history by date. It does not silently replace your existing data.</p>
      </details>
    </section>
  `;
  root.querySelector("[data-backup-export]").onclick = () => exportJson().catch(() => setStatus("Could not export the backup.", true));
  root.querySelector("[data-backup-csv]").onclick = () => exportCsv().catch(() => setStatus("Could not export CSV.", true));
  root.querySelector("[data-backup-import]").onchange = event => importJson(event.target.files?.[0]);
}

export function mountBackup() {
  root = document.getElementById("slBackup");
  if (!root) return;
  render();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountBackup, { once: true });
else mountBackup();
