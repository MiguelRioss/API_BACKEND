// database/firebaseDB.mjs
import 'dotenv/config'; // safe to import again; dotenv is idempotent
import { initFirebase, getFirestore, getRealtimeDB, useRealtimeDB } from './firebase/firebaseInit.mjs';
import { NotFoundError, ExternalServiceError } from '../domain/domainErrors.mjs';
import { isObj , canonStatusKey ,STATUS_KEYS} from './firebase/utilsDB.mjs';
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
export async function updateOrderDB(id, rawChanges = {}) {
  ensureInitDb();
  const idStr = String(id);

  // unwrap { changes: {...} } if present
  const changes = (rawChanges && rawChanges.changes && isObj(rawChanges.changes))
    ? rawChanges.changes
    : rawChanges;

  if (!useRealtimeDB()) {
    // Firestore fallback below
    return updateOrderFirestore(idStr, changes);
  }

  const db = getRealtimeDB();
  const ref = db.ref(`/orders/${idStr}`);
  const snap = await ref.once('value');
  if (!snap.exists()) throw new NotFoundError(`Order "${idStr}" not found`);
  const existing = snap.val() || {};

  // Build a multi-path update so we only touch the provided fields.
  // NOTE: RTDB .update() merges at the first level; using full paths lets us do deep merges safely.
  const updates = {};
  const add = (path, val) => { updates[`/orders/${idStr}/${path}`] = val; };

  // 1) Top-level simple fields you allow (extend as needed)
  const ALLOWED_TOP = new Set(["name", "email", "metadata", "status", "currency", "amount_total", "items", "track_url"]);
  for (const [k, v] of Object.entries(changes)) {
    if (!ALLOWED_TOP.has(k)) continue;
    if (!(k in existing)) continue; // keep schema tight

    // metadata/object shallow merge
    if (k === "metadata" && isObj(v) && isObj(existing.metadata)) {
      for (const [mk, mv] of Object.entries(v)) add(`metadata/${mk}`, mv);
      continue;
    }

    // items full replace (you can make this smarter if needed)
    if (k === "items") {
      add("items", v);
      continue;
    }

    // status handled below
    if (k !== "status") {
      add(k, v);
    }
  }

  // 2) Status bucket – accept either:
  //    - changes.status = { acceptedInCtt: {...}, in_traffic: {...}, ... }
  //    - flat status-like keys in changes (acceptedInCtt, in_traffic, ...)
  const statusBag = {};
  if (isObj(changes.status)) {
    for (const [sk, sv] of Object.entries(changes.status)) {
      const canon = canonStatusKey(sk);
      if (STATUS_KEYS.has(canon) && isObj(sv)) statusBag[canon] = sv;
    }
  }
  for (const [k, v] of Object.entries(changes)) {
    const canon = canonStatusKey(k);
    if (STATUS_KEYS.has(canon) && isObj(v)) statusBag[canon] = v;
  }

  if (Object.keys(statusBag).length) {
    // ensure status exists in DB
    if (!isObj(existing.status)) existing.status = {};

    for (const [sk, sv] of Object.entries(statusBag)) {
      // shallow merge per field to avoid wiping sibling props
      if (isObj(sv)) {
        for (const [field, val] of Object.entries(sv)) {
          add(`status/${sk}/${field}`, val);
        }
      } else {
        add(`status/${sk}`, sv);
      }
    }
  }

  // 3) updatedAt always
  add(`updatedAt`, new Date().toISOString());

  // Perform atomic fan-out update
  await db.ref().update(updates);

  // Return the fresh object
  const fresh = (await ref.once('value')).val();
  return { id: idStr, ...fresh };
}
