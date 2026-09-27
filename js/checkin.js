import { getEntries, saveEntries } from "./core/storage.js";
import { blankEntry, normalizeEntry } from "./core/schema.js";
import { localDateString } from "./core/date.js";

const root = document.getElementById("view-checkin");
if (!root) throw new Error("Sensory Log check-in root unavailable");

const state = {
  step: 0,
  date: localDateString(),
  energy: 0,
  overwhelm: 0,
  masking: null,
  recovery: 0,
  socialBattery: 0,
  sleepQuality: 0
};

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

const maskingOptions = [
  ["None", 0],
  ["1–2 h", 1],
  ["3–5 h", 2],
  ["6+ h", 3]
];

const shell = document.createElement("section");
shell.className = "sl-checkin";
shell.id = "slCheckin";
shell.innerHTML = `
  <div class="sl-checkin-shell">
    <div class="sl-checkin-top">
      <div>
        <div class="sl-checkin-kicker">Check in</div>
        <h2 class="sl-checkin-title">Notice first. Explain later.</h2>
        <p class="sl-checkin-sub">A few signals are enough. Everything else is optional.</p>
      </div>
      <div class="sl-checkin-progress" aria-label="Check-in progress">
        <i class="active"></i><i></i><i></i>
      </div>
    </div>

    <div class="sl-checkin-step active" data-step="0">
      <p class="sl-prompt">How much capacity do you have right now?</p>
      <p class="sl-helper">1 is depleted. 5 feels solid.</p>
      <div class="sl-checkin-scale" id="newEnergy" role="group" aria-label="Energy"></div>
      <div class="sl-scale-caption"><span>Depleted</span><span>Solid</span></div>
      <label class="sl-checkin-date"><span>Logging</span><input type="date" id="newDate"></label>
      <div class="sl-checkin-nav">
        <button class="next" type="button">Continue</button>
      </div>
    </div>

    <div class="sl-checkin-step" data-step="1">
      <p class="sl-prompt">What is your system noticing?</p>
      <p class="sl-helper">Pick only what feels useful. You can leave this step blank.</p>
      <div class="sl-checkin-field">
        <div class="sl-field-title">Sensory load</div>
        <div class="sl-choice" id="newOverwhelm" role="group" aria-label="Sensory load"></div>
        <div class="sl-scale-caption"><span>Low</span><span>High</span></div>
      </div>
      <div class="sl-checkin-field">
        <div class="sl-field-title">Masking</div>
        <div class="sl-choice sl-choice-four" id="newMasking" role="group" aria-label="Masking"></div>
      </div>
      <div class="sl-checkin-summary" id="contextSummary"></div>
      <div class="sl-checkin-nav">
        <button class="back" type="button">Back</button>
        <button class="next" type="button">Continue</button>
      </div>
    </div>

    <div class="sl-checkin-step" data-step="2">
      <p class="sl-prompt">What would support you?</p>
      <p class="sl-helper">Notice what you need. Nothing here is a prescription.</p>
      <div class="sl-checkin-field">
        <div class="sl-field-title">Recovery needed</div>
        <div class="sl-choice" id="newRecovery" role="group" aria-label="Recovery needed"></div>
        <div class="sl-scale-caption"><span>Little</span><span>A lot</span></div>
      </div>
      <div class="sl-checkin-field">
        <div class="sl-field-title">Social battery</div>
        <div class="sl-choice" id="newSocial" role="group" aria-label="Social battery"></div>
        <div class="sl-scale-caption"><span>Empty</span><span>Full</span></div>
      </div>
      <div class="sl-checkin-field">
        <div class="sl-field-title">Sleep quality <span class="optional">optional</span></div>
        <div class="sl-choice" id="newSleep" role="group" aria-label="Sleep quality"></div>
      </div>
      <div class="sl-checkin-summary" id="supportSummary"></div>
      <div class="sl-checkin-nav">
        <button class="back" type="button">Back</button>
        <button class="save" type="button">Save check-in</button>
      </div>
      <div class="sl-checkin-message" id="newMessage" role="status" aria-live="polite"></div>
    </div>
  </div>`;
root.appendChild(shell);

function buildScale(id, field, count = 5) {
  const box = document.getElementById(id);
  for (let i = 1; i <= count; i++) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = i;
    button.setAttribute("aria-label", `${field} ${i} of ${count}`);
    button.onclick = () => { state[field] = i; render(); };
    box.appendChild(button);
  }
}

function buildMasking() {
  const box = document.getElementById("newMasking");
  maskingOptions.forEach(([label, value]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.onclick = () => { state.masking = value; render(); };
    box.appendChild(button);
  });
}

buildScale("newEnergy", "energy");
buildScale("newOverwhelm", "overwhelm");
buildScale("newRecovery", "recovery");
buildScale("newSocial", "socialBattery");
buildScale("newSleep", "sleepQuality");
buildMasking();

const dateInput = document.getElementById("newDate");
dateInput.value = state.date;
dateInput.onchange = () => { state.date = dateInput.value; };

function setSelected(id, value) {
  document.querySelectorAll(`#${id} button`).forEach((button, index) => {
    const selected = id === "newMasking"
      ? maskingOptions[index]?.[1] === value
      : index + 1 === value;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function render() {
  shell.querySelectorAll(".sl-checkin-step").forEach(step => {
    step.classList.toggle("active", Number(step.dataset.step) === state.step);
  });
  shell.querySelectorAll(".sl-checkin-progress i").forEach((dot, index) => {
    dot.classList.toggle("active", index <= state.step);
  });

  setSelected("newEnergy", state.energy);
  setSelected("newOverwhelm", state.overwhelm);
  setSelected("newMasking", state.masking);
  setSelected("newRecovery", state.recovery);
  setSelected("newSocial", state.socialBattery);
  setSelected("newSleep", state.sleepQuality);

  document.getElementById("contextSummary").innerHTML =
    state.overwhelm || state.masking !== null
      ? `<strong>Noted:</strong> ${[
          state.overwhelm ? `sensory load ${state.overwhelm}/5` : "",
          state.masking !== null ? `masking ${esc(maskingOptions[state.masking]?.[0] || "")}` : ""
        ].filter(Boolean).join(" · ")}`
      : "Nothing selected here — that is completely fine.";

  document.getElementById("supportSummary").innerHTML =
    state.recovery || state.socialBattery || state.sleepQuality
      ? `<strong>Noted:</strong> ${[
          state.recovery ? `recovery ${state.recovery}/5` : "",
          state.socialBattery ? `social battery ${state.socialBattery}/5` : "",
          state.sleepQuality ? `sleep quality ${state.sleepQuality}/5` : ""
        ].filter(Boolean).join(" · ")}`
      : "No support signal selected yet.";
}

async function save() {
  const message = document.getElementById("newMessage");
  if (!state.energy) {
    message.textContent = "Choose your current energy first. Everything else can stay blank.";
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.date)) {
    message.textContent = "Choose a valid date.";
    return;
  }

  const existing = await getEntries();
  const previous = existing.find(entry => entry.date === state.date);
  const entry = normalizeEntry({
    ...(previous || blankEntry(state.date)),
    date: state.date,
    energy: state.energy,
    overwhelm: state.overwhelm,
    masking: state.masking,
    recovery: state.recovery,
    socialBattery: state.socialBattery,
    sleepQuality: state.sleepQuality
  });

  const result = await saveEntries([...existing.filter(entry => entry.date !== state.date), entry]);
  if (!result.ok) {
    message.textContent = result.error || "Could not save this check-in locally.";
    return;
  }

  window.dispatchEvent(new CustomEvent("sensory-log:entries-changed"));
  message.textContent = "Saved. You can leave the rest for another day.";
  document.querySelectorAll(".sl-checkin-nav button").forEach(button => button.disabled = true);
  setTimeout(() => {
    document.querySelector('[data-route="home"]')?.click();
  }, 650);
}

shell.querySelector('[data-step="0"] .next').onclick = () => {
  if (!state.energy) {
    document.getElementById("newMessage").textContent = "Choose your current energy first.";
    return;
  }
  state.step = 1;
  render();
};
shell.querySelector('[data-step="1"] .back').onclick = () => { state.step = 0; render(); };
shell.querySelector('[data-step="1"] .next').onclick = () => { state.step = 2; render(); };
shell.querySelector('[data-step="2"] .back').onclick = () => { state.step = 1; render(); };
shell.querySelector(".save").onclick = save;

render();
