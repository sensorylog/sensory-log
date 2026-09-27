import { getEntries } from "./core/storage.js";

const KEY = "sensoryLogOnboarding_v1";
let root = null;
let step = 0;

function seen() {
  try { return localStorage.getItem(KEY) === "complete"; } catch { return false; }
}

function complete() {
  try { localStorage.setItem(KEY, "complete"); } catch {}
  root?.remove();
  root = null;
}

function render() {
  if (!root) return;
  const steps = [
    {
      kicker: "Welcome to Sensory Log",
      title: "Start with how you are — not how you think you should be.",
      text: "Sensory Log helps you notice your energy, sensory load, recovery and context over time. You do not need to know what a pattern means before you begin.",
      action: "Continue"
    },
    {
      kicker: "Private by design",
      title: "Your history stays yours.",
      text: "Your everyday log is designed around local storage. You can export a portable backup whenever you want, and you can choose what to share if you use optional reflection tools later.",
      action: "Continue"
    },
    {
      kicker: "No pressure",
      title: "One check-in is enough to start.",
      text: "There are no streaks to protect and no perfect amount to log. Check in when it is useful, look for repeated observations, and use Regulation when you need support now.",
      action: "Start Sensory Log"
    }
  ];
  const current = steps[step];
  root.innerHTML = `
    <div class="sl-onboarding-backdrop"></div>
    <section class="sl-onboarding-panel" role="dialog" aria-modal="true" aria-labelledby="slOnboardingTitle">
      <div class="sl-onboarding-progress" aria-label="Welcome progress">
        ${steps.map((_, i) => `<span class="${i === step ? "is-active" : ""}" aria-hidden="true"></span>`).join("")}
      </div>
      <div class="sl-onboarding-kicker">${current.kicker}</div>
      <h1 id="slOnboardingTitle">${current.title}</h1>
      <p>${current.text}</p>
      <div class="sl-onboarding-actions">
        <button type="button" data-onboarding-action>${current.action}</button>
        ${step > 0 ? '<button type="button" class="sl-onboarding-skip" data-onboarding-back>Back</button>' : '<button type="button" class="sl-onboarding-skip" data-onboarding-skip>Skip intro</button>'}
      </div>
    </section>
  `;
  root.querySelector("[data-onboarding-action]").onclick = () => {
    if (step < steps.length - 1) { step += 1; render(); }
    else complete();
  };
  root.querySelector("[data-onboarding-back]")?.addEventListener("click", () => { step -= 1; render(); });
  root.querySelector("[data-onboarding-skip]")?.addEventListener("click", complete);
}

export async function initOnboarding() {
  if (seen()) return;
  const entries = await getEntries();
  if (entries.length) return;
  root = document.createElement("div");
  root.id = "slOnboarding";
  root.className = "sl-onboarding";
  document.body.appendChild(root);
  render();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initOnboarding(), { once: true });
} else {
  initOnboarding();
}
