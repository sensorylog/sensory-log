(function () {
  "use strict";

  // Sensory Log is intentionally using a simple Gumroad access-link gate.
  // Replace this value when the product access key changes.
  var VALID_ACCESS_KEY = "SL-SENSORY-2026";
  var STORAGE_KEY = "sensoryLog_access_granted_v1";
  var URL_PARAM = "access";

  function normalize(value) {
    return String(value || "").trim().toUpperCase();
  }

  function isAuthorized() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch (_) {
      return false;
    }
  }

  function grantAccess() {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch (_) {}
  }

  function stripAccessFromUrl() {
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete(URL_PARAM);
      window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : "") + url.hash);
    } catch (_) {}
  }

  function validKey(value) {
    return normalize(value) === normalize(VALID_ACCESS_KEY);
  }

  function lockPage() {
    document.documentElement.classList.add("sl-access-locked");

    var existing = document.getElementById("sl-access-gate");
    if (existing) return;

    var gate = document.createElement("div");
    gate.id = "sl-access-gate";
    gate.className = "sl-access-gate";
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    gate.setAttribute("aria-labelledby", "sl-access-title");
    gate.innerHTML =
      '<div class="sl-access-orb" aria-hidden="true"><span>SL</span></div>' +
      '<div class="sl-access-kicker">SENSORY LOG</div>' +
      '<h1 id="sl-access-title">Your space is waiting.</h1>' +
      '<p class="sl-access-lead">Sensory Log is available to customers with a valid access link. Enter your access key once, or open the access link from your purchase email.</p>' +
      '<form class="sl-access-form" novalidate>' +
        '<label for="sl-access-key">Access key</label>' +
        '<div class="sl-access-input-wrap">' +
          '<span aria-hidden="true">SL</span>' +
          '<input id="sl-access-key" name="access" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="SL-XXXX-XXXX-XXXX" aria-describedby="sl-access-status" />' +
        '</div>' +
        '<button type="submit" class="sl-access-submit">Continue</button>' +
        '<p id="sl-access-status" class="sl-access-status" role="status" aria-live="polite"></p>' +
      '</form>' +
      '<div class="sl-access-divider"><span>or</span></div>' +
      '<a class="sl-access-purchase" href="https://kbjohnson.gumroad.com/" rel="noopener">Get Sensory Log access</a>' +
      '<p class="sl-access-foot">One purchase. Complete core experience. No subscription.</p>' +
      '<p class="sl-access-security">Your access is remembered on this device after activation.</p>';

    document.body.appendChild(gate);

    var form = gate.querySelector(".sl-access-form");
    var input = gate.querySelector("#sl-access-key");
    var status = gate.querySelector("#sl-access-status");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!validKey(input.value)) {
        status.textContent = "That access key could not be verified.";
        status.classList.add("is-error");
        input.select();
        return;
      }

      grantAccess();
      stripAccessFromUrl();
      gate.remove();
      document.documentElement.classList.remove("sl-access-locked");
      window.dispatchEvent(new CustomEvent("sensory-log:access-granted"));
    });

    input.addEventListener("input", function () {
      status.textContent = "";
      status.classList.remove("is-error");
    });

    window.setTimeout(function () { input.focus(); }, 0);
  }

  var params = new URLSearchParams(window.location.search);
  var urlKey = params.get(URL_PARAM);

  if (validKey(urlKey)) {
    grantAccess();
    stripAccessFromUrl();
  }

  if (!isAuthorized()) {
    if (document.body) lockPage();
    else document.addEventListener("DOMContentLoaded", lockPage, { once: true });
  }
})();
