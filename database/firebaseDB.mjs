// database/firebaseDB.mjs
import 'dotenv/config'; // safe to import again; dotenv is idempotent
import { initFirebase, getFirestore, getRealtimeDB, useRealtimeDB } from './firebase/firebaseInit.mjs';
import { NotFoundError, ExternalServiceError } from '../domain/domainErrors.mjs';

/**
 * Ensure Firebase is initialized before any db operation.
 * You may call initFirebase() at app startup (recommended).
 */
function ensureInit() {
  try {
    initFirebase();
  } catch (err) {
    // Wrap init errors as ExternalServiceError so API layer can handle consistently
    throw new ExternalServiceError(`Firebase initialization failed: ${err && err.message}`, err);
  }
}

/**
 * Get all orders (RTDB or Firestore depending on env).
 * Returns an array of { id, ...data }.
 */
export async function getAllOrders(options = {}) {
  ensureInit();
  try {
    if (useRealtimeDB()) {
      const db = getRealtimeDB();
      const snap = await db.ref('/orders').once('value');
      const val = snap.val() || {};
      return Object.entries(val).map(([id, data]) => ({ id, ...data }));
    }

    const fsdb = getFirestore();
    let q = fsdb.collection('orders');

    if (options.where) {
      const clauses = Array.isArray(options.where) ? options.where : [options.where];
      for (const c of clauses) {
        q = q.where(c.field, c.op, c.value);
      }
    }

    if (options.orderBy) q = q.orderBy(options.orderBy.field, options.orderBy.direction || 'desc');
    else q = q.orderBy('createdAt', 'desc');

    if (options.limit) q = q.limit(options.limit);

    const snap = await q.get();
    return snap.docs.map(doc => {
      const data = doc.data();
      if (data && data.createdAt && typeof data.createdAt.toDate === 'function') {
        data.createdAt = data.createdAt.toISOString();
      }
      return { id: doc.id, ...data };
    });
  } catch (err) {
    // Log for server-side debugging. Wrap as ExternalServiceError for callers.
    console.error('getAllOrders error:', err && err.stack);
    throw new ExternalServiceError('Failed to read orders from DB', err);
  }
}
// Assumes these are imported at the top of the module:
// import { NotFoundError } from '../api/errors/domainErrors.mjs';
// import { initFirebase, getFirestore, getRealtimeDB, useRealtimeDB } from './firebase/firebaseInit.mjs';
// and ensureInit() calls initFirebase() or throws.

export async function getOrderById(idStr) {
  // DO NOT validate idStr here. The service layer must supply a valid, normalised idStr.
  ensureInit(); // will throw ExternalServiceError if init fails

  // RTDB path
  if (useRealtimeDB()) {
    const db = getRealtimeDB();
    const snap = await db.ref(`/orders/${idStr}`).once('value');
    const val = snap.val();
    if (val === null || typeof val === 'undefined') {
      throw new NotFoundError(`Order ${idStr} not found`);
    }
    return { id: idStr, ...val };
  }

  // Firestore path
  const fsdb = getFirestore();
  const doc = await fsdb.collection('orders').doc(idStr).get();
  if (!doc.exists) {
    throw new NotFoundError(`Order ${idStr} not found`);
  }
  const data = doc.data();
  if (data && data.createdAt && typeof data.createdAt.toDate === 'function') {
    data.createdAt = data.createdAt.toISOString();
  }
  return { id: doc.id, ...data };
}

// database/firebaseDB.mjs
// Required helpers (adjust path if your module uses a different name / location):
// import { initFirebase, getRealtimeDB, getFirestore, useRealtimeDB } from './firebase/firebaseInit.mjs';
// import 'dotenv/config';

export async function createOrderDB(orderData = {}, keyOrOptions) {
  console.log('[createOrderDB] start');

  let id;
  if (typeof keyOrOptions === 'string' || typeof keyOrOptions === 'number') {
    id = String(keyOrOptions);
  } else if (keyOrOptions && typeof keyOrOptions === 'object') {
    if (typeof keyOrOptions.id !== 'undefined' && keyOrOptions.id !== null) {
      id = keyOrOptions.id;
    } else if (typeof keyOrOptions.key !== 'undefined' && keyOrOptions.key !== null) {
      id = keyOrOptions.key;
    }
  }

  const incomingIdForLog = typeof id === 'undefined' || id === null ? '<undefined>' : id;
  console.log('[createOrderDB] incoming id:', incomingIdForLog);

  // Log a few env-presence checks (safe: do NOT log secret contents)
  try {
    console.log('[createOrderDB] FIREBASE_SERVICE_ACCOUNT_PATH present?', !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    console.log('[createOrderDB] FIREBASE_SERVICE_ACCOUNT_B64 present?', !!process.env.FIREBASE_SERVICE_ACCOUNT_B64);
    console.log('[createOrderDB] FIREBASE_USE_RTDB:', process.env.FIREBASE_USE_RTDB);
  } catch (e) {
    console.warn('[createOrderDB] env check failed', e && e.message);
  }

  try {
    console.log('[createOrderDB] initializing firebase...');
    initFirebase(); // ensure firebase initialized (will throw if creds missing)
    console.log('[createOrderDB] firebase init ok');
  } catch (err) {
    console.error('[createOrderDB] initFirebase() FAILED ->', err && err.message);
    throw err;
  }

  const createdAt = new Date().toISOString();
  const payload = { ...orderData, createdAt };
  console.log('[createOrderDB] prepared payload (createdAt set)');

  try {
    if (useRealtimeDB()) {
      console.log('[createOrderDB] using Realtime Database branch (RTDB)');
      const db = getRealtimeDB();
      console.log('[createOrderDB] got RTDB instance');

      if (typeof id !== 'undefined' && id !== null) {
        const key = String(id);
        console.log(`[createOrderDB] writing to RTDB at /orders/${key} (overwrite/create)`);
        await db.ref(`/orders/${key}`).set(payload);
        console.log(`[createOrderDB] RTDB write OK -> id=${key}`);
        return { id: key, ...payload };
      } else {
        console.log('[createOrderDB] pushing new child to /orders (RTDB)');
        const newRef = db.ref('/orders').push();
        console.log('[createOrderDB] RTDB newRef.key ->', newRef.key);
        await newRef.set(payload);
        console.log('[createOrderDB] RTDB push+set OK -> id=', newRef.key);
        return { id: newRef.key, ...payload };
      }
    }

    // Firestore branch
    console.log('[createOrderDB] using Firestore branch');
    const fs = getFirestore();
    console.log('[createOrderDB] got Firestore instance');

    if (typeof id !== 'undefined' && id !== null) {
      const key = String(id);
      console.log(`[createOrderDB] setting doc orders/${key} (set overwrite/create)`);
      const docRef = fs.collection('orders').doc(key);
      await docRef.set(payload);
      console.log(`[createOrderDB] Firestore set OK -> id=${key}`);
      return { id: key, ...payload };
    } else {
      console.log('[createOrderDB] adding new doc to orders collection (add)');
      const docRef = await fs.collection('orders').add(payload);
      console.log('[createOrderDB] Firestore add OK -> id=', docRef.id);
      return { id: docRef.id, ...payload };
    }
  } catch (err) {
    console.error('[createOrderDB] WRITE ERROR ->', err && err.stack ? err.stack : err && err.message ? err.message : err);
    throw err;
  }
}
