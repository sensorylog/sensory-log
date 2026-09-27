const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const crypto = require("node:crypto");

initializeApp();

const db = getFirestore();
const gumroadProductId = defineString("GUMROAD_PRODUCT_ID");

const PRODUCT = "sensory-log";
const MAX_KEY_LENGTH = 256;

function normalizeKey(value) {
  return String(value || "").trim();
}

function hashKey(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

async function verifyWithGumroad(licenseKey, incrementUsesCount) {
  const productId = gumroadProductId.value();
  if (!productId) {
    throw new HttpsError("failed-precondition", "Sensory Log licensing is not configured.");
  }

  const body = new URLSearchParams({
    product_id: productId,
    license_key: licenseKey,
    increment_uses_count: incrementUsesCount ? "true" : "false"
  });

  const response = await fetch("https://api.gumroad.com/v2/licenses/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    throw new HttpsError("unavailable", "The license service returned an invalid response.");
  }

  if (!response.ok || !data?.success) {
    throw new HttpsError("permission-denied", "That Sensory Log license could not be verified.");
  }

  if (data.purchase?.refunded || data.purchase?.chargebacked || data.purchase?.cancelled) {
    throw new HttpsError("permission-denied", "This Sensory Log purchase is no longer active.");
  }

  return { data, productId };
}

async function writeEntitlement({ uid, licenseKey, gumroad, productId }) {
  const licenseHash = hashKey(licenseKey);
  const userRef = db.doc(`users/${uid}`);
  const licenseRef = db.doc(`licenses/${licenseHash}`);
  const purchase = gumroad.purchase || {};

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(licenseRef);

    if (existing.exists && existing.data().uid && existing.data().uid !== uid) {
      throw new HttpsError("permission-denied", "This license is already attached to another account.");
    }

    transaction.set(userRef, {
      product: PRODUCT,
      entitlement: {
        status: "active",
        licenseHash,
        productId,
        purchaseId: purchase.id || null,
        email: purchase.email || null,
        verifiedAt: FieldValue.serverTimestamp()
      },
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    transaction.set(licenseRef, {
      uid,
      product: PRODUCT,
      productId,
      status: "active",
      purchaseId: purchase.id || null,
      uses: Number(gumroad.uses || 0),
      updatedAt: FieldValue.serverTimestamp(),
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() })
    }, { merge: true });
  });

  return { status: "active", product: PRODUCT, licenseHash };
}

exports.activateLicense = onCall({
  region: "us-central1",
  enforceAppCheck: true
}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in before activating Sensory Log.");
  }

  const licenseKey = normalizeKey(request.data?.licenseKey);
  if (!licenseKey || licenseKey.length > MAX_KEY_LENGTH) {
    throw new HttpsError("invalid-argument", "Enter a valid Sensory Log license key.");
  }

  const { data, productId } = await verifyWithGumroad(licenseKey, true);
  return writeEntitlement({
    uid: request.auth.uid,
    licenseKey,
    gumroad: data,
    productId
  });
});

exports.refreshLicense = onCall({
  region: "us-central1",
  enforceAppCheck: true
}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in before checking your license.");
  }

  const licenseHash = normalizeKey(request.data?.licenseHash);
  if (!/^[a-f0-9]{64}$/.test(licenseHash)) {
    throw new HttpsError("invalid-argument", "A valid stored license reference is required.");
  }

  const licenseRef = db.doc(`licenses/${licenseHash}`);
  const licenseSnap = await licenseRef.get();
  if (!licenseSnap.exists || licenseSnap.data().uid !== request.auth.uid) {
    throw new HttpsError("permission-denied", "This license is not attached to this account.");
  }

  const stored = licenseSnap.data();
  const keySecret = request.data?.licenseKey;
  if (typeof keySecret !== "string" || keySecret.length < 1 || keySecret.length > MAX_KEY_LENGTH) {
    throw new HttpsError("invalid-argument", "License revalidation requires the original key.");
  }

  if (hashKey(keySecret) !== licenseHash) {
    throw new HttpsError("permission-denied", "The stored license reference does not match.");
  }

  const { data, productId } = await verifyWithGumroad(keySecret, false);
  await licenseRef.set({
    status: "active",
    productId,
    uses: Number(data.uses || 0),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await db.doc(`users/${request.auth.uid}`).set({
    entitlement: {
      status: "active",
      licenseHash,
      productId,
      purchaseId: data.purchase?.id || stored.purchaseId || null,
      verifiedAt: FieldValue.serverTimestamp()
    },
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return { status: "active", product: PRODUCT, licenseHash };
});
