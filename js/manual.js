import { getEntries, getLocal, setLocal } from "./core/storage.js";
import { buildPersonalModel, DEFAULT_MANUAL } from "./core/manual-engine.js";

const KEY = "sensoryLogPersonalManual_v1";
let root = null;
let entries = [];
let model = null;

const esc = value => String(value ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
const lines = values => (Array.isArray(values) ? values : []).join("\n");

async function loadManual() {
  const saved = await getLocal(KEY, DEFAULT_MANUAL);
  return saved && typeof saved === "object" ? saved : DEFAULT_MANUAL;
}

async function saveManual(value) {
  const result = await setLocal(KEY, value);
  if (!result.ok) throw new Error(result.error || "Could not save your manual locally.");
}

function evidenceList(values) {
  if (!values?.length) return '<p class="sl-manual-muted">Not enough history yet.</p>';
  return values.map(item => `<div class="sl-manual-evidence-row"><span>${esc(item.label)}</span><small>${item.days} logged day${item.days === 1 ? "" : "s"}</small></div>`).join("");
}

function render() {
  if (!root || !model) return;
  const d = model.declared, e = model.evidence;
  root.innerHTML = `
    <section class="sl-manual-hero"><div><div class="sl-manual-kicker">Personal operating manual</div><h2>A model of what you know about yourself.</h2><p>Your declarations stay separate from what your history happens to show. You decide what belongs in your manual.</p></div><span class="sl-manual-count">${e.days} logged day${e.days === 1 ? "" : "s"}</span></section>

    <section class="sl-manual-model-card">
      <div class="sl-manual-kicker">Declare it</div><h3>Sensory profile</h3>
      <p>Write preferences and inputs you already know are useful or difficult. One item per line.</p>
      <div class="sl-manual-model-grid">
        <div class="sl-manual-field"><label for="slManualSensory">Prefer / works well</label><textarea id="slManualSensory">${esc(lines(d.sensory.preferences))}</textarea></div>
        <div class="sl-manual-field"><label for="slManualReduce">Reduce when possible</label><textarea id="slManualReduce">${esc(lines(d.sensory.reduce))}</textarea></div>
        <div class="sl-manual-field"><label for="slManualHelpful">Helpful inputs</label><textarea id="slManualHelpful">${esc(lines(d.sensory.helpfulInputs))}</textarea></div>
        <div class="sl-manual-field"><label for="slManualGeneral">Other preferences</label><textarea id="slManualGeneral">${esc(lines(d.preferences))}</textarea></div>
      </div>
    </section>

    <section class="sl-manual-model-card">
      <div class="sl-manual-kicker">Performance & masking</div><h3>What changes when you have to perform?</h3>
      <div class="sl-manual-model-grid">
        <div class="sl-manual-field"><label for="slManualSituations">Situations that increase masking</label><textarea id="slManualSituations">${esc(lines(d.masking.situations))}</textarea></div>
        <div class="sl-manual-field"><label for="slManualStrategies">Things that make it easier</label><textarea id="slManualStrategies">${esc(lines(d.masking.strategies))}</textarea></div>
      </div>
    </section>

    <section class="sl-manual-model-card">
      <div class="sl-manual-kicker">Communication</div><h3>How should other people communicate with you?</h3>
      <div class="sl-manual-model-grid">
        <div class="sl-manual-field"><label for="slManualPreferred">Prefer</label><textarea id="slManualPreferred">${esc(lines(d.communication.preferred))}</textarea></div>
        <div class="sl-manual-field"><label for="slManualAvoid">Avoid</label><textarea id="slManualAvoid">${esc(lines(d.communication.avoid))}</textarea></div>
        <div class="sl-manual-field"><label for="slManualScripts">Useful phrases / scripts</label><textarea id="slManualScripts">${esc(lines(d.communication.scripts))}</textarea></div>
        <div class="sl-manual-field"><label for="slManualStrengths">Strengths I choose to name</label><textarea id="slManualStrengths">${esc(lines(d.strengths))}</textarea></div>
      </div>
    </section>

    <section class="sl-manual-model-card">
      <div class="sl-manual-kicker">Accommodation builder</div><h3>Turn a need into your own request.</h3>
      <p>This creates plain-language requests. It does not decide what you are legally or medically entitled to.</p>
      <div class="sl-manual-accommodation"><input id="slManualNeed" maxlength="120" placeholder="Need (e.g. noise)"><input id="slManualRequest" maxlength="300" placeholder="My request (e.g. a quieter room)"><button type="button" id="slManualAddAccommodation">Add</button></div>
      <div class="sl-manual-declared-list">${d.accommodations.length ? d.accommodations.map((a,i)=>`<span class="sl-manual-chip">${esc(a.need)} · ${esc(a.request)} <button type="button" data-remove-accommodation="${i}" aria-label="Remove ${esc(a.need)}">×</button></span>`).join("") : '<p class="sl-manual-muted">No accommodation requests yet.</p>'}</div>
    </section>

    <section class="sl-manual-model-card">
      <div class="sl-manual-kicker">History is evidence, not identity</div><h3>What your log has shown</h3>
      <p>These are descriptive repetitions from your saved entries. They do not automatically become preferences or strengths.</p>
      <div class="sl-manual-evidence"><div class="sl-manual-evidence-title">Helpful</div>${evidenceList(e.helpful)}</div>
      <div class="sl-manual-evidence"><div class="sl-manual-evidence-title">Drains</div>${evidenceList(e.drains)}</div>
      <div class="sl-manual-evidence"><div class="sl-manual-evidence-title">Body signals</div>${evidenceList(e.body)}</div>
    </section>

    <section class="sl-manual-model-card">
      <div class="sl-manual-kicker">Private context</div><h3>Anything else you want this manual to remember?</h3>
      <div class="sl-manual-field"><textarea id="slManualNotes" maxlength="1000" rows="5" placeholder="Only include what you want to keep here.">${esc(d.notes)}</textarea></div>
      <div class="sl-manual-model-actions"><button class="sl-manual-save" type="button" id="slManualSave">Save my manual</button></div>
      <div class="sl-manual-updated" id="slManualStatus" role="status" aria-live="polite"></div>
    </section>`;
  bind();
}

function textLines(id) {
  return document.getElementById(id).value.split("\n").map(v => v.trim()).filter(Boolean).slice(0, 30);
}

function collect() {
  const d = model.declared;
  return {
    version: 1,
    sensory: { preferences: textLines("slManualSensory"), reduce: textLines("slManualReduce"), helpfulInputs: textLines("slManualHelpful") },
    masking: { situations: textLines("slManualSituations"), strategies: textLines("slManualStrategies") },
    communication: { preferred: textLines("slManualPreferred"), avoid: textLines("slManualAvoid"), scripts: textLines("slManualScripts") },
    accommodations: d.accommodations,
    strengths: textLines("slManualStrengths"),
    preferences: textLines("slManualGeneral"),
    notes: document.getElementById("slManualNotes").value.trim().slice(0, 1000)
  };
}

function bind() {
  root.querySelector("#slManualAddAccommodation")?.addEventListener("click", () => {
    const need = root.querySelector("#slManualNeed").value.trim().slice(0, 120);
    const request = root.querySelector("#slManualRequest").value.trim().slice(0, 300);
    if (!need || !request) return;
    model.declared.accommodations.push({ need, request });
    model.declared.accommodations = model.declared.accommodations.slice(0, 20);
    render();
  });
  root.querySelectorAll("[data-remove-accommodation]").forEach(button => button.addEventListener("click", () => {
    model.declared.accommodations.splice(Number(button.dataset.removeAccommodation), 1);
    render();
  }));
  root.querySelector("#slManualSave")?.addEventListener("click", async () => {
    const status = root.querySelector("#slManualStatus");
    try {
      await saveManual(collect());
      model = buildPersonalModel(await loadManual(), entries);
      status.textContent = "Saved locally. Your manual is ready to use across the app.";
      window.dispatchEvent(new CustomEvent("sensory-log:manual-changed"));
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

export async function mountManual() {
  entries = await getEntries();
  model = buildPersonalModel(await loadManual(), entries);
  root = document.getElementById("slManual");
  if (!root) {
    root = document.createElement("section");
    root.id = "slManual";
    root.className = "sl-manual";
    document.getElementById("view-manual")?.appendChild(root);
  }
  render();
}

window.addEventListener("sensory-log:entries-changed", async () => {
  entries = await getEntries();
  if (root) {
    model = buildPersonalModel(await loadManual(), entries);
    render();
  }
});

mountManual();
