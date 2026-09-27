import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  doc,
  getDoc,
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseApp, firebaseAuth } from "./core/firebase.js";

const auth = firebaseAuth;
const db = getFirestore(firebaseApp);
const LICENSE_WORKER_URL = "https://sensory-log-license.johnkyei221.workers.dev";

const CACHE_KEY = "sensoryLog_entitlement_v2";
const OFFLINE_GRACE_MS = 14 * 24 * 60 * 60 * 1000;
const DEVICE_ID_KEY = "sensoryLog_device_id_v1";

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

function getDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : "sl-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch (_) {
    return "sl-session-" + Date.now().toString(36);
  }
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
  const messages = {
    "auth/invalid-email":"That email address doesn't look right.",
    "auth/weak-password":"Choose a stronger password with at least 6 characters.",
    "auth/email-already-in-use":"An account already exists with this email. Sign in instead.",
    "auth/invalid-credential":"That email or password is incorrect.",
    "auth/user-not-found":"We couldn't find an account with that email.",
    "auth/wrong-password":"That email or password is incorrect.",
    "auth/too-many-requests":"Too many attempts. Wait a moment and try again.",
    "auth/network-request-failed":"Check your connection and try again.",
    "auth/popup-closed-by-user":"Google sign-in was cancelled.",
    "auth/popup-blocked":"Google sign-in was blocked. Try again and allow the sign-in window.",
    "auth/account-exists-with-different-credential":"An account already exists with this email using another sign-in method. Sign in with that method first.",
    "auth/operation-not-allowed":"This sign-in method is not enabled yet.",
    "auth/unauthorized-domain":"This app domain is not authorized for sign-in yet."
  };
  if (messages[code]) return messages[code];
  if (code.includes("permission-denied")) return "That license is not valid for Sensory Log.";
  if (code.includes("unauthenticated")) return "Sign in first, then activate your license.";
  if (code.includes("failed-precondition")) return "Sensory Log licensing is not configured yet.";
  if (code.includes("unavailable")) return "License verification is temporarily unavailable. Try again in a moment.";
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

        <form data-auth-form novalidate>
          <label for="sl-license-email">Email</label>
          <input id="sl-license-email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" required>
          <div class="sl-license-password-row">
            <label for="sl-license-password">Password</label>
            <button type="button" class="sl-license-show-password" data-toggle-password>Show</button>
          </div>
          <input id="sl-license-password" type="password" autocomplete="current-password" minlength="6" required>
          <div class="sl-license-confirm-wrap" data-confirm-wrap hidden>
            <label for="sl-license-confirm">Confirm password</label>
            <input id="sl-license-confirm" type="password" autocomplete="new-password" minlength="6">
          </div>
          <button type="submit" class="sl-license-primary" data-auth-submit>Sign in</button>
        </form>
        <button type="button" class="sl-license-reset" data-reset>Forgot password?</button>
        <div class="sl-license-divider"><span>or</span></div>
        <button type="button" class="sl-license-google" data-google><span class="sl-google-icon" aria-hidden="true">G</span><span>Continue with Google</span></button>
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
      <p class="sl-license-foot">One purchase. Complete core experience. No subscription. Use your account on up to 2 devices.</p>
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
  gate.dataset.authMode = mode;
  gate.querySelectorAll("[data-auth-mode]").forEach(button => {
    const active = button.dataset.authMode === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  gate.querySelector("[data-auth-submit]").textContent = signup ? "Create account" : "Sign in";
  gate.querySelector("#sl-license-password").autocomplete = signup ? "new-password" : "current-password";
  gate.querySelector("#sl-license-password").value = "";
  gate.querySelector("#sl-license-confirm").value = "";
  gate.querySelector("[data-confirm-wrap]").hidden = !signup;
  gate.querySelector("#sl-license-confirm").required = signup;
  gate.querySelector("[data-reset]").hidden = signup;
  gate.querySelector("[data-toggle-password]").textContent = "Show";
  gate.querySelector("#sl-license-password").type = "password";
  gate.querySelector("#sl-license-confirm").type = "password";
}

async function showAuthenticatedGate(gate, user) {
  gate.querySelector("[data-auth-section]").hidden = true;
  gate.querySelector("[data-activation-section]").hidden = false;
  gate.querySelector("[data-account]").textContent = `Signed in as ${user.email || "your account"}`;

  try {
    const entitlement = await readEntitlement(user.uid);
    if (entitlement?.status === "active") {
      try {
        const registered = await registerDeviceWithWorker();
        currentEntitlement = { ...entitlement, ...registered };
        cacheEntitlement(currentEntitlement);
        unlock();
        return;
      } catch (error) {
        const cached = readCachedEntitlement();
        if (isUsableOffline(cached)) {
          currentEntitlement = cached;
          unlock();
          return;
        }
        setStatus(gate, "This device needs to be registered. Enter your Gumroad license key once.", true);
        return;
      }
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

async function registerDeviceWithWorker() {
  if (!LICENSE_WORKER_URL || LICENSE_WORKER_URL.includes("REPLACE-WITH-YOUR")) {
    throw new Error("Sensory Log licensing backend is not configured yet.");
  }
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("Sign in before opening Sensory Log.");
  const idToken = await user.getIdToken();
  const response = await fetch(LICENSE_WORKER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": "Bearer " + idToken
    },
    body: JSON.stringify({ mode: "register", deviceId: getDeviceId() })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "This device could not be registered.");
    if (response.status === 401) error.code = "unauthenticated";
    throw error;
  }
  return data;
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
    body: JSON.stringify({ licenseKey, mode, deviceId: getDeviceId() })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "License verification failed.");
    if (response.status === 401) error.code = "unauthenticated";
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

  gate.dataset.authMode = "signin";
  let authBusy = false;
  const setAuthBusy = busy => {
    authBusy = busy;
    gate.querySelectorAll("[data-auth-form] input, [data-auth-form] button, [data-google], [data-reset], [data-auth-mode]").forEach(el => el.disabled = busy);
    gate.querySelector("[data-auth-submit]").setAttribute("aria-busy", String(busy));
  };

  gate.querySelectorAll("[data-auth-mode]").forEach(button => {
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", button.dataset.authMode === "signin" ? "true" : "false");
    button.addEventListener("click", () => { if (!authBusy) updateAuthMode(gate, button.dataset.authMode); });
  });

  gate.querySelector("[data-toggle-password]").addEventListener("click", () => {
    const next = gate.querySelector("#sl-license-password").type === "password" ? "text" : "password";
    gate.querySelector("#sl-license-password").type = next;
    if (gate.dataset.authMode === "signup") gate.querySelector("#sl-license-confirm").type = next;
    gate.querySelector("[data-toggle-password]").textContent = next === "password" ? "Show" : "Hide";
  });

  gate.querySelector("[data-auth-form]").addEventListener("submit", async event => {
    event.preventDefault();
    if (authBusy) return;
    const emailInput = gate.querySelector("#sl-license-email");
    const email = emailInput.value.trim();
    const password = gate.querySelector("#sl-license-password").value;
    const confirm = gate.querySelector("#sl-license-confirm").value;
    const signup = gate.dataset.authMode === "signup";
    if (!emailInput.checkValidity()) { setStatus(gate, "Enter a valid email address.", true); emailInput.focus(); return; }
    if (password.length < 6) { setStatus(gate, "Your password needs at least 6 characters.", true); return; }
    if (signup && password !== confirm) { setStatus(gate, "The passwords don't match.", true); return; }
    setAuthBusy(true);
    try {
      setStatus(gate, signup ? "Creating your account…" : "Signing you in…");
      if (signup) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setStatus(gate, messageForError(error), true);
    } finally { setAuthBusy(false); }
  });

  gate.querySelector("[data-reset]").addEventListener("click", async () => {
    if (authBusy) return;
    const input = gate.querySelector("#sl-license-email");
    if (!input.checkValidity()) { setStatus(gate, "Enter your email first, then tap Forgot password.", true); input.focus(); return; }
    setAuthBusy(true);
    try {
      await sendPasswordResetEmail(auth, input.value.trim());
      setStatus(gate, "Password reset email sent. Check your inbox.");
    } catch (error) { setStatus(gate, messageForError(error), true); }
    finally { setAuthBusy(false); }
  });

  gate.querySelector("[data-google]").addEventListener("click", async () => {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      setStatus(gate, "Opening Google sign-in…");
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        await signInWithRedirect(auth, provider);
        return;
      }
      await signInWithPopup(auth, provider);
    } catch (error) {
      if (error?.code === "auth/popup-blocked" || error?.code === "auth/cancelled-popup-request") {
        try { await signInWithRedirect(auth, new GoogleAuthProvider()); return; }
        catch (redirectError) { setStatus(gate, messageForError(redirectError), true); return; }
      }
      setStatus(gate, messageForError(error), true);
    } finally { setAuthBusy(false); }
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
  purchase.href = "https://jbstoresfind.gumroad.com/l/sensory-log";

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
