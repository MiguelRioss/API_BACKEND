// database/firebaseInit.mjs
import admin from 'firebase-admin';
import 'dotenv/config'; // loads .env in dev

const isTruthy = v => (typeof v === 'string' ? v.toLowerCase() === 'true' : !!v);

/**
 * Only-support: base64-encoded service account JSON.
 * Env var names checked (in this order):
 *  - FIREBASE_SERVICE_ACCOUNT_BASE64  (preferred)
 *  - FIREBASE_SERVICE_ACCOUNT_B64
 *
 * If neither is present, we fall back to admin.credential.applicationDefault()
 * (useful when running inside GCP with ADC).
 */
function parseServiceAccountFromBase64Env() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ?? process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) return null;

  try {
    const jsonStr = Buffer.from(b64, 'base64').toString('utf8');
    // Defensive trim in case UI added stray whitespace/newlines
    const trimmed = jsonStr.trim();
    const parsed = JSON.parse(trimmed);
    return parsed;
  } catch (err) {
    // Re-throw with extra context so logs are helpful
    throw new Error(`Failed to decode/parse base64 Firebase service account: ${err.message}`);
  }
}

export function initFirebase({ force = false } = {}) {
  if (admin.apps && admin.apps.length && !force) return admin;

  let credential = null;

  try {
    const parsedFromB64 = parseServiceAccountFromBase64Env();
    if (parsedFromB64) {
      credential = admin.credential.cert(parsedFromB64);
    } else {
      // Fallback to ADC (GCP Application Default Credentials)
      credential = admin.credential.applicationDefault();
    }
  } catch (err) {
    const msg = `Failed to load Firebase credentials: ${err.message}`;
    console.error(msg);
    console.error(err && err.stack);
    throw new Error(msg);
  }

  const initOptions = {};
  if (credential) initOptions.credential = credential;
  if (process.env.FIREBASE_DATABASE_URL) initOptions.databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (process.env.FIREBASE_PROJECT_ID) initOptions.projectId = process.env.FIREBASE_PROJECT_ID;

  try {
    admin.initializeApp(initOptions);
    if (process.env.NODE_ENV !== 'production') {
      console.info(
        'Firebase Admin initialized (projectId=%s, useRTDB=%s)',
        process.env.FIREBASE_PROJECT_ID || '<unset>',
        process.env.FIREBASE_USE_RTDB || '<unset>'
      );
    }
    return admin;
  } catch (err) {
    console.error('Failed to initialize firebase-admin:', err && err.stack);
    throw new Error('Failed to initialize firebase-admin: ' + (err && err.message));
  }
}

export function getAdmin() {
  if (!admin.apps || !admin.apps.length) throw new Error('Firebase not initialized. Call initFirebase() first.');
  return admin;
}
export function getFirestore() { return getAdmin().firestore(); }
export function getRealtimeDB() { const a = getAdmin(); if (!a.database) throw new Error('RTDB not available'); return a.database(); }
export function isInitialized() { return !!(admin.apps && admin.apps.length); }
export function useRealtimeDB() { return isTruthy(process.env.FIREBASE_USE_RTDB); }
