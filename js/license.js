import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  doc,
  getDoc,
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseApp, firebaseAuth } from "./core/firebase.js";

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const LICENSE_WORKER_URL = "https://REPLACE-WITH-YOUR-SENSORY-LOG-LICENSE-WORKER.workers.dev";

const CACHE_KEY = "sensoryLog_entitlement_v2";
const OFFLINE_GRACE_MS = 14 * 24 * 60 * 60 * 1000;

let currentUser = null;
let currentEntitlement = null;
let resolveReady;
let rejectReady;
export const licenseReady = new Promise((resolve, reject) => {
  resolveReady = resolve;
  rejectReady = reject;
});

function setGateState(state) {
  document.documentElement.dataset.licenseState = state;
}

function cacheEntitlement(entitlement) {
  try {
    const safe = { ...entitlement };
    delete safe.licenseKey;
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ...safe,
      cachedAt: Date.now()
    }));
  } catch (_) {}
}

function readCachedEntitlement() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function clearCachedEntitlement() {
  try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
}

function isUsableOffline(entitlement) {
  return entitlement?.status === "active" &&
    Number.isFinite(entitlement.cachedAt) &&
    Date.now() - entitlement.cachedAt <= OFFLINE_GRACE_MS;
}

async function readEntitlement(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  const data = snapshot.exists() ? snapshot.data() : null;
  return data?.entitlement?.status === "active" ? data.entitlement : null;
}

function messageForError(error) {
  const code = error?.code || "";
  if (code.includes("permission-denied")) return "That license is not valid for Sensory Log.";
  if (code.includes("unauthenticated")) return "Sign in first, then activate your license.";
  if (code.includes("failed-precondition")) return "Sensory Log licensing is not configured yet.";
  if (code.includes("functions/unavailable") || code.includes("unavailable")) return "License verification is temporarily unavailable. Try again in a moment.";
  return error?.message || "Something went wrong. Please try again.";
}

function createGate() {
  if (document.getElementById("sl-license-gate")) return document.getElementById("sl-license-gate");

  const gate = document.createElement("main");
  gate.id = "sl-license-gate";
  gate.className = "sl-license-gate";
  gate.setAttribute("aria-labelledby", "sl-license-title");
  gate.innerHTML = `
    <div class="sl-license-panel">
      <div class="sl-license-mark" aria-hidden="true">SL</div>
      <div class="sl-license-kicker">SENSORY LOG</div>
      <h1 id="sl-license-title">Your space is waiting.</h1>
      <p class="sl-license-lead">Sign in to your Sensory Log account, then activate the license from your purchase.</p>

      <section class="sl-license-auth" data-auth-section>
        <div class="sl-license-auth-tabs" role="tablist" aria-label="Account">
          <button type="button" class="is-active" data-auth-mode="signin">Sign in</button>
          <button type="button" data-auth-mode="signup">Create account</button>
        </div>

        <form data-auth-form>
          <label for="sl-license-email">Email</label>
          <input id="sl-license-email" type="email" autocomplete="email" required>
          <label for="sl-license-password">Password</label>
          <input id="sl-license-password" type="password" autocomplete="current-password" minlength="6" required>
          <button type="submit" class="sl-license-primary" data-auth-submit>Sign in</button>
        </form>

        <button type="button" class="sl-license-google" data-google>Continue with Google</button>
        <div class="sl-license-divider"><span>then</span></div>
      </section>

      <section class="sl-license-activation" data-activation-section hidden>
        <p class="sl-license-account" data-account></p>
        <form data-license-form>
          <label for="sl-license-key">Gumroad license key</label>
          <input id="sl-license-key" name="licenseKey" type="text" autocomplete="off" spellcheck="false" required placeholder="Paste your Gumroad license key">
          <button type="submit" class="sl-license-primary">Activate Sensory Log</button>
        </form>
        <button type="button" class="sl-license-link" data-signout>Use another account</button>
      </section>

      <p class="sl-license-status" data-status role="status" aria-live="polite"></p>
      <a class="sl-license-purchase" href="#" data-purchase rel="noopener">Get Sensory Log</a>
      <p class="sl-license-foot">One purchase. Complete core experience. No subscription.</p>
    </div>`;

  document.body.appendChild(gate);
  return gate;
}

function setStatus(gate, message, isError = false) {
  const node = gate.querySelector("[data-status]");
  node.textContent = message || "";
  node.classList.toggle("is-error", Boolean(isError));
}

function updateAuthMode(gate, mode) {
  const signup = mode === "signup";
  gate.querySelectorAll("[data-auth-mode]").forEach(button => {
    button.classList.toggle("is-active", button.dataset.authMode === mode);
  });
  gate.querySelector("[data-auth-submit]").textContent = signup ? "Create account" : "Sign in";
  gate.querySelector("#sl-license-password").autocomplete = signup ? "new-password" : "current-password";
}

async function showAuthenticatedGate(gate, user) {
  gate.querySelector("[data-auth-section]").hidden = true;
  gate.querySelector("[data-activation-section]").hidden = false;
  gate.querySelector("[data-account]").textContent = `Signed in as ${user.email || "your account"}`;

  try {
    const entitlement = await readEntitlement(user.uid);
    if (entitlement?.status === "active") {
      currentEntitlement = entitlement;
      cacheEntitlement(entitlement);
      unlock();
      return;
    }
  } catch (error) {
    const cached = readCachedEntitlement();
    if (isUsableOffline(cached)) {
      currentEntitlement = cached;
      unlock();
      return;
    }
    setStatus(gate, "We couldn't check your license. Connect to the internet and try again.", true);
  }
}

async function verifyLicenseWithWorker(licenseKey, mode = "activate") {
  if (!LICENSE_WORKER_URL || LICENSE_WORKER_URL.includes("REPLACE-WITH-YOUR")) {
    throw new Error("Sensory Log licensing backend is not configured yet.");
  }
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("Sign in before activating Sensory Log.");
  const idToken = await user.getIdToken();
  const response = await fetch(LICENSE_WORKER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": "Bearer " + idToken
    },
    body: JSON.stringify({ licenseKey, mode })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "License verification failed.");
    error.code = response.status === 401 ? "unauthenticated" : "permission-denied";
    throw error;
  }
  return data;
}

function unlock() {
  setGateState("ready");
  document.getElementById("sl-license-gate")?.remove();
  resolveReady(currentEntitlement);
  window.dispatchEvent(new CustomEvent("sensory-log:license-ready", {
    detail: { entitlement: currentEntitlement }
  }));
}

async function boot() {
  setGateState("checking");
  const gate = createGate();

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (_) {}

  gate.querySelectorAll("[data-auth-mode]").forEach(button => {
    button.addEventListener("click", () => updateAuthMode(gate, button.dataset.authMode));
  });

  gate.querySelector("[data-auth-form]").addEventListener("submit", async event => {
    event.preventDefault();
    const email = gate.querySelector("#sl-license-email").value.trim();
    const password = gate.querySelector("#sl-license-password").value;
    const signup = gate.querySelector("[data-auth-submit]").textContent === "Create account";

    try {
      setStatus(gate, signup ? "Creating your account…" : "Signing you in…");
      if (signup) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setStatus(gate, messageForError(error), true);
    }
  });

  gate.querySelector("[data-google]").addEventListener("click", async () => {
    try {
      setStatus(gate, "Opening Google sign-in…");
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      if (error?.code === "auth/popup-blocked" || error?.code === "auth/cancelled-popup-request") {
        try {
          await signInWithRedirect(auth, new GoogleAuthProvider());
          return;
        } catch (redirectError) {
          setStatus(gate, messageForError(redirectError), true);
          return;
        }
      }
      setStatus(gate, messageForError(error), true);
    }
  });

  gate.querySelector("[data-license-form]").addEventListener("submit", async event => {
    event.preventDefault();
    const licenseKey = gate.querySelector("#sl-license-key").value.trim();
    if (!currentUser || !licenseKey) return;

    try {
      setStatus(gate, "Verifying your purchase…");
      const result = await verifyLicenseWithWorker(licenseKey, "activate");
      currentEntitlement = result;
      cacheEntitlement(currentEntitlement);
      unlock();
    } catch (error) {
      setStatus(gate, messageForError(error), true);
    }
  });

  gate.querySelector("[data-signout]").addEventListener("click", async () => {
    await signOut(auth);
    currentUser = null;
    currentEntitlement = null;
    gate.querySelector("[data-auth-section]").hidden = false;
    gate.querySelector("[data-activation-section]").hidden = true;
    setStatus(gate, "Signed out.");
  });

  const purchase = gate.querySelector("[data-purchase]");
  purchase.href = "https://gumroad.com/"; // Replace with the exact Sensory Log product URL before launch.

  onAuthStateChanged(auth, async user => {
    currentUser = user;
    if (!user) {
      setGateState("locked");
      gate.querySelector("[data-auth-section]").hidden = false;
      gate.querySelector("[data-activation-section]").hidden = true;
      return;
    }
    await showAuthenticatedGate(gate, user);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}

export function waitForLicense() {
  return licenseReady;
}
