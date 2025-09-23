// database/firebaseInit.mjs
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import 'dotenv/config'; // loads .env in dev

const isTruthy = v => (typeof v === 'string' ? v.toLowerCase() === 'true' : !!v);

function resolveServiceAccountPath() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_PATH) return null;
  return path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
}

function parseServiceAccountFromEnv() {
  // 1) raw JSON env
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
  // 2) base64-encoded JSON env
  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8');
    return JSON.parse(decoded);
  }
  return null;
}

export function initFirebase({ force = false } = {}) {
  if (admin.apps && admin.apps.length && !force) return admin;

  let credential = null;
  const saPath = resolveServiceAccountPath();

  try {
    // Prefer: env JSON/B64
    const parsedFromEnv = parseServiceAccountFromEnv();
    if (parsedFromEnv) {
      credential = admin.credential.cert(parsedFromEnv);
    }
    // If no env credential but a path is provided and exists -> use file
    else if (saPath && fs.existsSync(saPath)) {
      const raw = fs.readFileSync(saPath, 'utf8');
      const parsed = JSON.parse(raw);
      credential = admin.credential.cert(parsed);
    }
    // else fallback to ADC (GCP)
    else {
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

export function getAdmin() {
  if (!admin.apps || !admin.apps.length) throw new Error('Firebase not initialized. Call initFirebase() first.');
  return admin;
}
export function getFirestore(){ return getAdmin().firestore(); }
export function getRealtimeDB(){ const a=getAdmin(); if(!a.database) throw new Error('RTDB not available'); return a.database(); }
export function isInitialized(){ return !!(admin.apps && admin.apps.length); }
export function useRealtimeDB(){ return isTruthy(process.env.FIREBASE_USE_RTDB); }
