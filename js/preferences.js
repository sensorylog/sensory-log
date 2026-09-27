const KEY = "sensoryLogPreferences_v1";
const defaults = Object.freeze({ motion: "system", transparency: "system", contrast: "system" });

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { ...defaults, ...(value && typeof value === "object" ? value : {}) };
  } catch { return { ...defaults }; }
}

function save(prefs) {
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {}
}

export function apply(prefs = read()) {
  const root = document.documentElement;
  [["motion","motion"],["transparency","transparency"],["contrast","contrast"]].forEach(([key, attr]) => {
    if (prefs[key] === "on") root.dataset[attr] = "reduced";
    else if (prefs[key] === "off") root.dataset[attr] = "normal";
    else delete root.dataset[attr];
  });
}

function label(value) {
  return value === "on" ? "On" : value === "off" ? "Off" : "System";
}

export function initPreferences() {
  apply();
  const root = document.getElementById("slPreferences");
  if (!root) return;
  const prefs = read();
  root.innerHTML = `
    <section class="sl-preferences-card">
      <div class="sl-preferences-kicker">Comfort</div>
      <h3>Make Sensory Log easier on your senses.</h3>
      <p>These settings only change how the interface is presented on this device.</p>
      <div class="sl-preference-list">
        ${[
          ["motion","Reduce motion","Limits interface animation and movement."],
          ["transparency","Reduce transparency","Uses more solid surfaces instead of glass effects."],
          ["contrast","Increase contrast","Strengthens borders and visual separation."]
        ].map(([key,title,desc]) => `
          <div class="sl-preference-row">
            <div><strong>${title}</strong><span>${desc}</span></div>
            <button type="button" data-pref="${key}" aria-label="${title}: ${label(prefs[key])}">${label(prefs[key])}</button>
          </div>`).join("")}
      </div>
    </section>
  `;
  root.querySelectorAll("[data-pref]").forEach(button => {
    button.onclick = () => {
      const key = button.dataset.pref;
      const next = { system: "on", on: "off", off: "system" };
      const updated = { ...read(), [key]: next[read()[key]] };
      save(updated);
      apply(updated);
      initPreferences();
    };
  });
}

apply();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initPreferences, { once: true });
else initPreferences();
