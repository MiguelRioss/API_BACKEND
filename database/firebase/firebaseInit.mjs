// database/firebaseInit.mjs
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import 'dotenv/config'; // load .env from project root in dev

const isTruthy = v => (typeof v === 'string' ? v.toLowerCase() === 'true' : !!v);

function resolveServiceAccountPath() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_PATH) return null;
  return path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
}

/**
 * Initialize firebase-admin (idempotent).
 * Accepts optional overrides, but by default reads process.env.* variables:
 * - FIREBASE_SERVICE_ACCOUNT_PATH  (./secrets/...)
 * - FIREBASE_SERVICE_ACCOUNT_JSON  (full JSON string, less ideal)
 * - FIREBASE_DATABASE_URL
 * - FIREBASE_PROJECT_ID
 *
 * Returns the admin namespace.
 */
export function initFirebase({ force = false } = {}) {
  if (admin.apps && admin.apps.length && !force) {
    // already initialized -> return admin instance
    return admin;
  }

  let credential = null;
  const saPath = resolveServiceAccountPath();

  try {
    if (saPath) {
      if (!fs.existsSync(saPath)) {
        throw new Error(`Service account file not found at ${saPath}`);
      }
      const raw = fs.readFileSync(saPath, 'utf8');
      const parsed = JSON.parse(raw);
      credential = admin.credential.cert(parsed);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      credential = admin.credential.cert(parsed);
    } else {
      // fallback to application default credentials (GCP)
      credential = admin.credential.applicationDefault();
    }
  } catch (err) {
    // surface parse/file errors immediately
    const msg = `Failed to load Firebase credentials: ${err.message}`;
    // keep detailed stack in console for debugging
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
    // optional: enable debug logging in dev
    if (process.env.NODE_ENV !== 'production') {
      console.info('Firebase Admin initialized (projectId=%s, useRTDB=%s)',
        process.env.FIREBASE_PROJECT_ID || '<unset>',
        process.env.FIREBASE_USE_RTDB || '<unset>');
    }
    return admin;
  } catch (err) {
    console.error('Failed to initialize firebase-admin:', err && err.stack);
    throw new Error('Failed to initialize firebase-admin: ' + (err && err.message));
  }
}

/** return the initialized admin namespace (or throw if not init) */
export function getAdmin() {
  if (!admin.apps || !admin.apps.length) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }
  return admin;
}

/** utility: get Firestore instance (after init) */
export function getFirestore() {
  return getAdmin().firestore();
}

/** utility: get RTDB instance (after init) */
export function getRealtimeDB() {
  const a = getAdmin();
  if (!a.database) {
    throw new Error('Realtime Database not available in this admin build.');
  }
  return a.database();
}

/** boolean helper */
export function isInitialized() {
  return !!(admin.apps && admin.apps.length);
}

/** convenience: should we use RTDB? */
export function useRealtimeDB() {
  return isTruthy(process.env.FIREBASE_USE_RTDB);
}
