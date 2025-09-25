// database/firebaseDB.mjs
import 'dotenv/config'; // safe to import again; dotenv is idempotent
import { initFirebase, getFirestore, getRealtimeDB, useRealtimeDB } from './firebase/firebaseInit.mjs';
import { NotFoundError, ExternalServiceError } from '../domain/domainErrors.mjs';

/**
 * Ensure Firebase is initialized before any db operation.
 * You may call initFirebase() at app startup (recommended).
 */
function ensureInitDb() {
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
  ensureInitDb();
  try {
    if (useRealtimeDB()) {
      const db = getRealtimeDB();
      const snap = await db.ref('/orders').once('value');
      const val = snap.val() || {};
      return Object.entries(val).map(([id, data]) => ({ id, ...data }));
    }
  } catch (err) {
    throw new ExternalServiceError('Failed to read orders from DB', err);
  }
}
// Assumes these are imported at the top of the module:
// import { NotFoundError } from '../api/errors/domainErrors.mjs';
// import { initFirebase, getFirestore, getRealtimeDB, useRealtimeDB } from './firebase/firebaseInit.mjs';
// and ensureInitDb() calls initFirebase() or throws.

export async function getOrderById(idStr) {
  // DO NOT validate idStr here. The service layer must supply a valid, normalised idStr.
  ensureInitDb(); // will throw ExternalServiceError if init fails
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
}

export async function createOrderDB(orderData = {}) {
  console.log('[createOrderDB] start');
  const id = orderData.id
  ensureInitDb()
  const createdAt = new Date().toISOString();
  const payload = { ...orderData, createdAt };
  try {
    if (useRealtimeDB()) {
      const db = getRealtimeDB();
      if (typeof id !== 'undefined' && id !== null) {
        const key = String(id);
        await db.ref(`/orders/${key}`).set(payload);
        return { id: key, ...payload };
      } else {
        const newRef = db.ref('/orders').push();
        await newRef.set(payload);
        return { id: newRef.key, ...payload };
      }
    }
  } catch (err) {
    console.error('[createOrderDB] WRITE ERROR ->', err && err.stack ? err.stack : err && err.message ? err.message : err);
    throw err;
  }
}
