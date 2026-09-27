import { getEntries } from "./core/storage.js";
import { localDateString, parseLocalDate } from "./core/date.js";

const root = document.getElementById("view-home");
if (!root) throw new Error("Sensory Log home root unavailable");

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const average = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[char]));
const today = localDateString();

function formatDate(value, options = { weekday:"short", month:"short", day:"numeric" }) {
  const date = parseLocalDate(value);
  return date ? new Intl.DateTimeFormat(undefined, options).format(date) : value;
}

function getToday(entries) {
  return entries.find(entry => entry.date === today) || null;
}

function describeState(entry) {
  if (!entry?.energy) {
    return {
      title: "Start with where you are",
      detail: "A quick check-in gives the rest of the app something real to work with.",
      action: "Check in"
    };
  }
  if (entry.overwhelm >= 4) {
    return {
      title: "A lot is reaching you",
      detail: "Your sensory load is high in today's check-in. Reducing input may be useful before adding more demands.",
      action: "Find some room"
    };
  }
  if (entry.energy <= 2 && entry.recovery >= 4) {
    return {
      title: "Capacity looks low",
      detail: "Energy is low and recovery need is high today. Protecting space may be useful.",
      action: "Protect some space"
    };
  }
  if (entry.masking >= 2 && entry.energy <= 3) {
    return {
      title: "You may need more room",
      detail: "Lower energy and heavier masking are showing up together today. Notice what becomes easier when you can reduce performance.",
      action: "Make some room"
    };
  }
  if (entry.energy >= 4 && entry.overwhelm <= 2) {
    return {
      title: "Your state looks steadier",
      detail: "Energy is relatively solid and sensory load is not especially high in today's check-in.",
      action: "Keep noticing"
    };
  }
  if (entry.recovery >= 4) {
    return {
      title: "Recovery is asking for attention",
      detail: "Your recovery need is high today. Looking back at what has helped on similar days may be useful.",
      action: "Recover"
    };
  }
  return {
    title: "Your state is mixed",
    detail: "There is no single answer to solve. The useful part is noticing what is present.",
    action: "Keep noticing"
  };
}

function needFor(entry) {
  if (!entry?.energy) return {
    title: "One minute is enough",
    detail: "You can log energy now and leave the rest blank."
  };
  if (entry.overwhelm >= 4) return {
    title: "Less input",
    detail: "Quiet, lower light, fewer conversations, or a familiar environment may be worth trying."
  };
  if (entry.energy <= 2) return {
    title: "Lower the demand",
    detail: "Choose the smallest next action and leave room for recovery rather than pushing through."
  };
  if (entry.recovery >= 4) return {
    title: "Recovery space",
    detail: "Look back at strategies that have helped you recover without adding more stimulation."
  };
  if (entry.masking >= 2) return {
    title: "Less performance",
    detail: "If it is safe to do so, notice where you can reduce social or sensory masking."
  };
  return {
    title: "Keep observing",
    detail: "Your current signals do not point to one obvious need. That is useful information too."
  };
}

function metric(label, value, hint) {
  return `<div class="sl-home-metric">
    <span class="sl-home-metric-label">${esc(label)}</span>
    <strong>${value || "—"}<small>${value ? " / 5" : ""}</small></strong>
    <span class="sl-home-metric-hint">${esc(hint)}</span>
  </div>`;
}

function render(entries) {
  const todayEntry = getToday(entries);
  const state = describeState(todayEntry);
  const need = needFor(todayEntry);
  const logged = entries.filter(entry => entry.energy > 0).sort((a,b) => a.date.localeCompare(b.date));
  const prior = logged.filter(entry => entry.date !== today).slice(-7);
  const baseline = average(prior.map(entry => entry.energy));
  const delta = baseline && todayEntry?.energy ? todayEntry.energy - baseline : null;
  const recent = logged.slice(-7).reverse();

  const rhythm = recent.length
    ? recent.map(entry => `<button class="sl-home-day" type="button" data-home-date="${esc(entry.date)}" aria-label="Open ${esc(formatDate(entry.date))}, energy ${entry.energy} of 5">
        <span>${esc(formatDate(entry.date, {month:"short",day:"numeric"}))}</span>
        <strong>${entry.energy}</strong>
        <i style="--day-level:${clamp(entry.energy / 5, 0, 1)}"></i>
      </button>`).join("")
    : '<p class="sl-home-empty">Your rhythm will appear here as you log days.</p>';

  const baselineBlock = baseline
    ? `<div class="sl-home-baseline-row"><span>Average energy</span><strong>${baseline.toFixed(1)} / 5</strong></div>
       <div class="sl-home-baseline-row"><span>Today vs baseline</span><strong>${delta > 0 ? "↑ " : delta < 0 ? "↓ " : "— "}${Math.abs(delta).toFixed(1)}</strong></div>`
    : '<p class="sl-home-empty">A personal baseline needs a few logged days. It is calculated from your history, not a target.</p>';

  root.innerHTML = `
    <section class="sl-home-hero" aria-labelledby="slHomeTitle">
      <div class="sl-home-hero-top">
        <div>
          <div class="sl-home-kicker">Today · ${esc(formatDate(today))}</div>
          <h1 id="slHomeTitle">How are you, right now?</h1>
        </div>
        <div class="sl-home-status">${todayEntry ? "Logged today" : "Not checked in"}</div>
      </div>
      <div class="sl-home-state">
        <div class="sl-state-orb" aria-hidden="true"><strong>${todayEntry?.energy || "—"}</strong><span>energy</span></div>
        <div class="sl-home-state-copy">
          <h2>${esc(state.title)}</h2>
          <p>${esc(state.detail)}</p>
        </div>
      </div>
      <div class="sl-home-actions">
        <button type="button" class="sl-home-action primary" data-home-route="checkin">${todayEntry ? "Update check-in" : "Check in"}</button>
        <button type="button" class="sl-home-action" data-home-route="patterns">See patterns</button>
      </div>
    </section>

    <section class="sl-home-section" aria-labelledby="slSignalsTitle">
      <div class="sl-home-section-head">
        <div><span class="sl-home-eyebrow">Right now</span><h2 id="slSignalsTitle">Your signals</h2></div>
        <span class="sl-home-section-meta">${todayEntry ? "today" : "waiting"}</span>
      </div>
      <div class="sl-home-metrics">
        ${metric("Energy", todayEntry?.energy, "capacity")}
        ${metric("Sensory load", todayEntry?.overwhelm, "input")}
        ${metric("Recovery", todayEntry?.recovery, "need")}
        ${metric("Social battery", todayEntry?.socialBattery, "capacity")}
      </div>
    </section>

    <section class="sl-home-section sl-home-need" aria-labelledby="slNeedTitle">
      <div class="sl-home-section-head">
        <div><span class="sl-home-eyebrow">Next</span><h2 id="slNeedTitle">What might you need?</h2></div>
      </div>
      <div class="sl-home-need-content">
        <span class="sl-home-need-mark" aria-hidden="true"></span>
        <div><strong>${esc(need.title)}</strong><p>${esc(need.detail)}</p></div>
      </div>
      ${todayEntry?.energy && (todayEntry.overwhelm >= 4 || todayEntry.energy <= 2 || todayEntry.recovery >= 4)
        ? '<button type="button" class="sl-home-inline-action" data-home-route="regulate">Open a regulation protocol</button>' : ""}
    </section>

    <section class="sl-home-section" aria-labelledby="slBaselineTitle">
      <div class="sl-home-section-head">
        <div><span class="sl-home-eyebrow">Over time</span><h2 id="slBaselineTitle">Your baseline</h2></div>
        <span class="sl-home-section-meta">previous 7 days</span>
      </div>
      <div class="sl-home-baseline">${baselineBlock}</div>
    </section>

    <section class="sl-home-section" aria-labelledby="slRecentTitle">
      <div class="sl-home-section-head">
        <div><span class="sl-home-eyebrow">Recent</span><h2 id="slRecentTitle">Your rhythm</h2></div>
        <span class="sl-home-section-meta">tap a day</span>
      </div>
      <div class="sl-home-rhythm">${rhythm}</div>
    </section>
  `;

  root.querySelectorAll("[data-home-route]").forEach(button => {
    button.addEventListener("click", () => {
      window.location.hash = "#" + button.dataset.homeRoute;
    });
  });

  root.querySelectorAll("[data-home-date]").forEach(button => {
    button.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("sensory-log:open-date", {
        detail: { date: button.dataset.homeDate }
      }));
    });
  });
}

async function refresh() {
  try {
    render(await getEntries());
  } catch (error) {
    console.error("[Sensory Log] Home", error);
    render([]);
  }
}

refresh();
window.addEventListener("sensory-log:entries-changed", refresh);
window.addEventListener("sensory-log:open-date", event => {
  if (event.detail?.date) window.location.hash = "#checkin";
});
