const PRODUCT = "sensory-log";
const MAX_KEY_LENGTH = 256;
const MAX_DEVICE_ID_LENGTH = 128;
const MAX_DEVICES = 2;
let cachedGoogleToken = null;

function json(data, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization"
    }
  });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map(v => v.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : "";
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function utf8(value) {
  return new TextEncoder().encode(value);
}

function pemToBytes(pem) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function createServiceJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(utf8(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64Url(utf8(JSON.stringify({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/datastore",
    iat: now,
    exp: now + 3600
  })));
  const signingInput = header + "." + payload;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, utf8(signingInput));
  return signingInput + "." + base64Url(new Uint8Array(signature));
}

async function getGoogleAccessToken(env) {
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > Date.now() + 60_000) {
    return cachedGoogleToken.token;
  }
  const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const assertion = await createServiceJwt(serviceAccount);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("Google service authorization failed.");
  cachedGoogleToken = {
    token: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000
  };
  return data.access_token;
}

async function verifyFirebaseUser(idToken, env) {
  const response = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(env.FIREBASE_WEB_API_KEY),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  );
  const data = await response.json();
  if (!response.ok || !data.users?.[0]?.localId || data.users[0].disabled) {
    throw new Error("Firebase authentication is invalid.");
  }
  return data.users[0];
}

async function hashKey(value) {
  const digest = await crypto.subtle.digest("SHA-256", utf8(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyGumroad(licenseKey, env, incrementUsesCount) {
  const response = await fetch("https://api.gumroad.com/v2/licenses/verify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      product_id: env.GUMROAD_PRODUCT_ID,
      license_key: licenseKey,
      increment_uses_count: incrementUsesCount ? "true" : "false"
    })
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error("That Sensory Log license could not be verified.");
  const purchase = data.purchase || {};
  if (purchase.refunded || purchase.chargebacked || purchase.cancelled) {
    throw new Error("This Sensory Log purchase is no longer active.");
  }
  return data;
}

async function firestoreRequest(path, init, env) {
  const token = await getGoogleAccessToken(env);
  return fetch("https://firestore.googleapis.com/v1/projects/" +
    encodeURIComponent(env.FIREBASE_PROJECT_ID) + "/databases/(default)/documents/" + path, {
    ...init,
    headers: {
      ...(init.headers || {}),
      authorization: "Bearer " + token,
      "content-type": "application/json"
    }
  });
}

function stringValue(value) { return { stringValue: String(value ?? "") }; }
function integerValue(value) { return { integerValue: String(Number(value || 0)) }; }
function timestampValue(value = new Date().toISOString()) { return { timestampValue: value }; }

async function saveEntitlement(uid, licenseHash, gumroad, deviceHash, env) {
  const purchase = gumroad.purchase || {};
  const licensePath = "licenses/" + licenseHash;
  const existingResponse = await firestoreRequest(licensePath, { method: "GET" }, env);
  let existing = null;
  if (existingResponse.ok) existing = await existingResponse.json();

  const existingUid = existing?.fields?.uid?.stringValue;
  if (existingUid && existingUid !== uid) throw new Error("This license is already attached to another account.");

  const existingDevices = existing?.fields?.devices?.mapValue?.fields || {};
  const deviceKeys = Object.keys(existingDevices);
  const knownDevice = Boolean(existingDevices[deviceHash]);
  if (!knownDevice && deviceKeys.length >= MAX_DEVICES) {
    throw new Error("This license is already active on two devices. Remove an existing device before adding another.");
  }

  const now = new Date().toISOString();
  const devices = { ...existingDevices };
  devices[deviceHash] = {
    mapValue: { fields: {
      firstSeenAt: existingDevices[deviceHash]?.mapValue?.fields?.firstSeenAt || timestampValue(now),
      lastSeenAt: timestampValue(now)
    }}
  };
  const entitlement = {
    mapValue: { fields: {
      status: stringValue("active"),
      licenseHash: stringValue(licenseHash),
      productId: stringValue(env.GUMROAD_PRODUCT_ID),
      purchaseId: stringValue(purchase.id || ""),
      verifiedAt: timestampValue(now)
    }}
  };

  const userResponse = await firestoreRequest(
    "users/" + encodeURIComponent(uid) + "?updateMask.fieldPaths=entitlement&updateMask.fieldPaths=updatedAt",
    { method: "PATCH", body: JSON.stringify({
      fields: { entitlement, updatedAt: timestampValue(now) }
    })},
    env
  );
  if (!userResponse.ok) throw new Error("Firebase entitlement could not be saved.");

  const licenseFields = {
    uid: stringValue(uid),
    product: stringValue(PRODUCT),
    productId: stringValue(env.GUMROAD_PRODUCT_ID),
    status: stringValue("active"),
    purchaseId: stringValue(purchase.id || ""),
    uses: integerValue(gumroad.uses || 0),
    deviceLimit: integerValue(MAX_DEVICES),
    devices: { mapValue: { fields: devices } },
    updatedAt: timestampValue(now)
  };
  if (existing?.fields?.createdAt) licenseFields.createdAt = existing.fields.createdAt;
  else licenseFields.createdAt = timestampValue(now);

  const licenseResponse = await firestoreRequest(
    licensePath,
    { method: "PATCH", body: JSON.stringify({ fields: licenseFields })},
    env
  );
  if (!licenseResponse.ok) throw new Error("Firebase license record could not be saved.");

  return {
    status: "active",
    product: PRODUCT,
    licenseHash,
    productId: env.GUMROAD_PRODUCT_ID,
    purchaseId: purchase.id || null,
    deviceLimit: MAX_DEVICES,
    activeDevices: Object.keys(devices).length
  };
}

async function registerExistingDevice(uid, licenseHash, deviceHash, env) {
  const licensePath = "licenses/" + licenseHash;
  const response = await firestoreRequest(licensePath, { method: "GET" }, env);
  if (!response.ok) throw new Error("Your Sensory Log license could not be found.");
  const existing = await response.json();
  const existingUid = existing.fields?.uid?.stringValue;
  const status = existing.fields?.status?.stringValue;
  if (existingUid !== uid || status !== "active") {
    throw new Error("Your Sensory Log license is not active.");
  }

  const existingDevices = existing.fields?.devices?.mapValue?.fields || {};
  const deviceKeys = Object.keys(existingDevices);
  const knownDevice = Boolean(existingDevices[deviceHash]);
  if (!knownDevice && deviceKeys.length >= MAX_DEVICES) {
    throw new Error("This license is already active on two devices. Remove an existing device before adding another.");
  }

  const now = new Date().toISOString();
  const devices = { ...existingDevices };
  devices[deviceHash] = {
    mapValue: { fields: {
      firstSeenAt: existingDevices[deviceHash]?.mapValue?.fields?.firstSeenAt || timestampValue(now),
      lastSeenAt: timestampValue(now)
    }}
  };

  const updated = await firestoreRequest(
    licensePath + "?updateMask.fieldPaths=devices&updateMask.fieldPaths=updatedAt",
    { method: "PATCH", body: JSON.stringify({
      fields: {
        devices: { mapValue: { fields: devices } },
        updatedAt: timestampValue(now)
      }
    })},
    env
  );
  if (!updated.ok) throw new Error("The device could not be registered.");
  return {
    status: "active",
    product: PRODUCT,
    licenseHash,
    productId: existing.fields?.productId?.stringValue || null,
    purchaseId: existing.fields?.purchaseId?.stringValue || null,
    deviceLimit: MAX_DEVICES,
    activeDevices: Object.keys(devices).length
  };
}

async function handle(request, env) {
  const origin = allowedOrigin(request, env);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: {
      "access-control-allow-origin": origin || "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization"
    }});
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin || "*");
  if (!origin && env.ALLOWED_ORIGINS) return json({ error: "Origin not allowed." }, 403, "*");

  try {
    const auth = request.headers.get("Authorization") || "";
    const idToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!idToken) return json({ error: "Sign in before activating Sensory Log." }, 401, origin || "*");

    const user = await verifyFirebaseUser(idToken, env);
    const body = await request.json();
    const deviceId = String(body.deviceId || "").trim();
    if (!deviceId || deviceId.length > MAX_DEVICE_ID_LENGTH) {
      return json({ error: "This device could not be identified. Refresh the app and try again." }, 400, origin || "*");
    }

    const mode = body.mode === "register" ? "register" : body.mode === "refresh" ? "refresh" : "activate";
    const deviceHash = await hashKey(deviceId);

    if (mode === "register") {
      const userResponse = await firestoreRequest("users/" + encodeURIComponent(user.localId), { method: "GET" }, env);
      if (!userResponse.ok) return json({ error: "Your Sensory Log account does not have an active license." }, 403, origin || "*");
      const userData = await userResponse.json();
      const licenseHash = userData.fields?.entitlement?.mapValue?.fields?.licenseHash?.stringValue;
      if (!licenseHash) return json({ error: "Your Sensory Log account does not have an active license." }, 403, origin || "*");
      const entitlement = await registerExistingDevice(user.localId, licenseHash, deviceHash, env);
      return json(entitlement, 200, origin || "*");
    }

    const licenseKey = String(body.licenseKey || "").trim();
    if (!licenseKey || licenseKey.length > MAX_KEY_LENGTH) {
      return json({ error: "Enter a valid Sensory Log license key." }, 400, origin || "*");
    }

    const licenseHash = await hashKey(licenseKey);
    if (mode === "refresh") {
      const existing = await firestoreRequest("licenses/" + licenseHash, { method: "GET" }, env);
      if (!existing.ok) return json({ error: "This license is not attached to your account." }, 403, origin || "*");
      const existingData = await existing.json();
      if (existingData.fields?.uid?.stringValue !== user.localId) {
        return json({ error: "This license is not attached to your account." }, 403, origin || "*");
      }
    }

    const gumroad = await verifyGumroad(licenseKey, env, mode === "activate");
    const entitlement = await saveEntitlement(user.localId, licenseHash, gumroad, deviceHash, env);
    return json(entitlement, 200, origin || "*");
  } catch (error) {
    return json({ error: error?.message || "License verification failed." }, 403, origin || "*");
  }
}

export default { fetch: handle };
