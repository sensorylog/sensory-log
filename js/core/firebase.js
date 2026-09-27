/**
 * Sensory Log Firebase bootstrap.
 * Public Firebase web configuration and reCAPTCHA Enterprise site keys are safe
 * to ship to the browser; secrets such as Gemini API keys are never stored here.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app-check.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-functions.js";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-ai.js";

const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyANtJDTHU8g_vG-K7yE8aiRlzz-sDI2fkM",
  authDomain: "sensorylog-3d630.firebaseapp.com",
  projectId: "sensorylog-3d630",
  storageBucket: "sensorylog-3d630.firebasestorage.app",
  messagingSenderId: "96536139056",
  appId: "1:96536139056:web:a8dc21ee3b8a68324564f5",
  measurementId: "G-4XJMSNJREC"
});

const RECAPTCHA_ENTERPRISE_SITE_KEY = "6LdhC9EtAAAAAOfRAyry_M4IGuP-dPx8uOUGsuel";

export const firebaseApp = initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);
export const firebaseFunctions = getFunctions(firebaseApp, "us-central1");

export const firebaseAppCheck = initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY),
  isTokenAutoRefreshEnabled: true
});

const ai = getAI(firebaseApp, {
  backend: new GoogleAIBackend()
});

export const geminiModel = getGenerativeModel(ai, {
  model: "gemini-3.8-flash"
});

export const FIREBASE_CONFIG = firebaseConfig;
