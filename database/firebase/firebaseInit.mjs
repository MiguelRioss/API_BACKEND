// database/firebaseInit.mjs
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import 'dotenv/config';

const isTruthy = v => (typeof v === 'string' ? v.toLowerCase() === 'true' : !!v);

function resolveServiceAccountPath() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_PATH) return null;
  return path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
}

/**
 * Robust service-account loader:
 * - If FIREBASE_SERVICE_ACCOUNT_JSON is present -> try JSON.parse as-is
 * - Else if FIREBASE_SERVICE_ACCOUNT_BASE64 / _B64 present -> decode base64 then JSON.parse
 * - Else if FIREBASE_SERVICE_ACCOUNT (legacy) present -> try JSON.parse
 * - Else if FIREBASE_SERVICE_ACCOUNT_PATH exists on disk -> read file and JSON.parse
 * - Else return null (caller will fall back to applicationDefault())
 *
 * IMPORTANT: never log private_key. We only log safe metadata (project_id).
 */
function loadServiceAccountSafe() {
  const rawJsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT;
  const b64Env = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ?? process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  const saPath = resolveServiceAccountPath();

  // 1) raw JSON env var (most explicit)
  if (rawJsonEnv) {
    try {
      const parsed = JSON.parse(rawJsonEnv);
      if (parsed && parsed.project_id) console.info('[firebaseInit] loaded service account from FIREBASE_SERVICE_ACCOUNT_JSON (project_id=%s)', parsed.project_id);
      else console.info('[firebaseInit] loaded service account from FIREBASE_SERVICE_ACCOUNT_JSON (no project_id)');
      return parsed;
    } catch (err) {
      // fallthrough to try base64 or path
      console.warn('[firebaseInit] FIREBASE_SERVICE_ACCOUNT_JSON present but not valid JSON: %s', err.message);
    }
  }

  // 2) base64 env var
  if (b64Env) {
    try {
      // decode and try parse
      const jsonStr = Buffer.from(b64Env, 'base64').toString('utf8').trim();
      const parsed = JSON.parse(jsonStr);
      if (parsed && parsed.project_id) console.info('[firebaseInit] decoded base64 service account (project_id=%s)', parsed.project_id);
      else console.info('[firebaseInit] decoded base64 service account (no project_id)');
      return parsed;
    } catch (err) {
      // If base64 decode or parse fails, keep going to try file fallback.
      console.warn('[firebaseInit] FIREBASE_SERVICE_ACCOUNT_BASE64 decode/parse failed: %s', err.message);
    }
  }

  // 3) fallback: file path (dev only)
  if (saPath && fs.existsSync(saPath)) {
    try {
      const raw = fs.readFileSync(saPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.project_id) console.info('[firebaseInit] loaded service account from file %s (project_id=%s)', saPath, parsed.project_id);
      else console.info('[firebaseInit] loaded service account from file %s (no project_id)', saPath);
      return parsed;
    } catch (err) {
      console.warn('[firebaseInit] failed to read/parse service account file %s: %s', saPath, err.message);
    }
  }

  // nothing found
  return null;
}

export function initFirebase({ force = false } = {}) {
  if (admin.apps && admin.apps.length && !force) return admin;

  let credential = null;

  try {
    const parsed = loadServiceAccountSafe();
    if (parsed) {
      credential = admin.credential.cert(parsed);
      console.info('[firebaseInit] Using service-account credentials.');
    } else {
      console.info('[firebaseInit] No service-account env found; falling back to applicationDefault()');
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
