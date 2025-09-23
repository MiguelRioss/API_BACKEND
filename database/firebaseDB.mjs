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

export async function createOrderDB(orderData = {}, { id = undefined } = {}) {
  // ensure Firebase admin is initialized (this will throw if creds are missing)
  initFirebase(); // or ensureInit(); depending on your module

  // attach createdAt right away so we can return it without another read
  const createdAt = new Date().toISOString();
  const payload = { ...orderData, createdAt };

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

  // Firestore branch
  const fs = getFirestore();

  if (typeof id !== 'undefined' && id !== null) {
    const key = String(id);
    const docRef = fs.collection('orders').doc(key);
    await docRef.set(payload);
    return { id: key, ...payload };
  } else {
    const docRef = await fs.collection('orders').add(payload);
    return { id: docRef.id, ...payload };
  }
}
