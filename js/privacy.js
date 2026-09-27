import { clearAllLocalData, getStorageInfo } from "./core/storage.js";

let root = null;

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

async function renderStatus() {
  const status = root?.querySelector("[data-privacy-storage]");
  if (!status) return;
  const info = await getStorageInfo();
  status.textContent = info.offlineCapable
    ? "Your core log is stored locally on this device."
    : "Local storage is currently unavailable in this browser.";
}

function render() {
  if (!root) return;
  root.innerHTML = `
    <section class="sl-privacy-hero">
      <div class="sl-privacy-kicker">Privacy center</div>
      <h2>Your data should stay understandable and yours.</h2>
      <p>Sensory Log keeps the core log local-first. You can inspect the storage state, export a copy, or permanently clear the app's local data from this device.</p>
    </section>
    <section class="sl-privacy-card">
      <div class="sl-privacy-row">
        <div><strong>Core storage</strong><span data-privacy-storage>Checking…</span></div>
        <span class="sl-privacy-badge">Local-first</span>
      </div>
      <div class="sl-privacy-divider"></div>
      <div class="sl-privacy-copy">
        <strong>What leaves the device?</strong>
        <p>Core check-ins, patterns, regulation history and your manual are not uploaded by the local logging flow. Optional external services are separate and only receive data when their feature is explicitly used.</p>
      </div>
    </section>
    <section class="sl-privacy-card sl-privacy-danger">
      <div class="sl-privacy-copy">
        <strong>Delete local data</strong>
        <p>This permanently removes Sensory Log's locally stored history, preferences, onboarding state and other app-local data on this device. Export a backup first if you may want it later.</p>
      </div>
      <button type="button" data-privacy-delete>Delete all local data</button>
      <p class="sl-privacy-status" data-privacy-status role="status" aria-live="polite"></p>
    </section>
    <section class="sl-privacy-details">
      <details>
        <summary>What is not covered?</summary>
        <p>Deleting browser data does not delete copies you previously exported or information you intentionally sent to an optional third-party service. Those are governed by the destination's own storage and privacy practices.</p>
      </details>
      <details>
        <summary>Want a portable copy?</summary>
        <p>Open <button type="button" class="sl-inline-link" data-route="backup">Your data</button> to export JSON or CSV before making changes.</p>
      </details>
    </section>
  `;

  root.querySelector("[data-route]")?.addEventListener("click", () => {
    location.hash = "#backup";
  });

  root.querySelector("[data-privacy-delete]")?.addEventListener("click", async () => {
    const status = root.querySelector("[data-privacy-status]");
    if (!window.confirm("Delete all Sensory Log data stored on this device?")) return;
    if (!window.confirm("This cannot be undone unless you have an exported backup. Delete it now?")) return;

    const button = root.querySelector("[data-privacy-delete]");
    button.disabled = true;
    try {
      const result = await clearAllLocalData();
      if (!result.ok) throw new Error(result.error || "Could not clear local data.");
      status.textContent = "Local Sensory Log data has been cleared from this device.";
      window.dispatchEvent(new CustomEvent("sensory-log:data-cleared"));
      setTimeout(() => location.reload(), 700);
    } catch (error) {
      button.disabled = false;
      status.textContent = error instanceof Error ? error.message : "Could not clear local data.";
      status.classList.add("is-error");
    }
  });

  renderStatus();
}

export function mountPrivacy() {
  root = document.getElementById("slPrivacy");
  if (!root) return;
  render();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountPrivacy, { once: true });
} else {
  mountPrivacy();
}
