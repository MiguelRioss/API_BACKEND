// database/firebaseDB.mjs
import "dotenv/config"; // dotenv is idempotent
import { initFirebase, getFirestore, getRealtimeDB, useRealtimeDB } from "./firebase/firebaseInit.mjs";
import errors from "../errors/errors.mjs"; // <- use your ApplicationError style
import { isObj, canonStatusKey, STATUS_KEYS } from "./firebase/utilsDB.mjs";

/**
 * Ensure Firebase is initialized before any db operation.
 * Wraps init errors as EXTERNAL_SERVICE_ERROR.
 */
function ensureInitDb() {
  try {
    initFirebase();
  } catch (err) {
    return Promise.reject(
      errors.EXTERNAL_SERVICE_ERROR(`Firebase initialization failed: ${err?.message ?? err}`, {
        original: err,
      })
    );
  }
}

/**
 * Get all orders (RTDB or Firestore depending on env).
 *
 * @returns {Promise<Object[]>} Array of orders.
 * @rejects {EXTERNAL_SERVICE_ERROR} If DB call fails.
 */
export async function getAllOrders() {
  const init = ensureInitDb();
  if (init) return init; // ensureInitDb may return a rejected promise

  if (useRealtimeDB()) {
    const db = getRealtimeDB();
    return db
      .ref("/orders")
      .once("value")
      .then((snap) => snap.val() || {})
      .then((val) => Object.entries(val).map(([id, data]) => ({ id, ...data })))
      .catch((err) =>
        Promise.reject(errors.EXTERNAL_SERVICE_ERROR("Failed to read orders from DB", { original: err }))
      );
  }

  return Promise.resolve([]);
}

/**
 * Get a single order by id.
 *
 * @param {string} idStr - Normalized order ID.
 * @returns {Promise<Object>} The found order.
 * @rejects {NOT_FOUND} If order doesn’t exist.
 */
export async function getOrderById(idStr) {
  const init = ensureInitDb();
  if (init) return init;

  if (useRealtimeDB()) {
    const db = getRealtimeDB();
    const snap = await db.ref(`/orders/${idStr}`).once("value");
    const val = snap.val();
    if (val === null || typeof val === "undefined") {
      return Promise.reject(errors.NOT_FOUND(`Order ${idStr} not found`));
    }
    return { id: idStr, ...val };
  }
}

/**
 * Create a new order in the DB.
 *
 * @param {Object} orderData
 * @returns {Promise<Object>} The created order.
 */
export async function createOrderDB(orderData = {}) {
  const id = orderData.id;
  const init = ensureInitDb();
  if (init) return init;

  const createdAt = new Date().toISOString();
  const payload = { ...orderData, createdAt };

  try {
    if (useRealtimeDB()) {
      const db = getRealtimeDB();
      if (typeof id !== "undefined" && id !== null) {
        const key = String(id);
        await db.ref(`/orders/${key}`).set(payload);
        return { id: key, ...payload };
      } else {
        const newRef = db.ref("/orders").push();
        await newRef.set(payload);
        return { id: newRef.key, ...payload };
      }
    }
  } catch (err) {
    return Promise.reject(errors.EXTERNAL_SERVICE_ERROR("Failed to write order to DB", { original: err }));
  }
}
/**
 * Update an order by replacing it with the provided object.
 * Same contract as localDB.updateOrderDB — service layer handles merging/normalization.
 *
 * @async
 * @param {string|number} id - Order ID
 * @param {Object} updatedOrder - Fully prepared order object
 * @returns {Promise<Object>} The updated order (with id included)
 * @rejects {NOT_FOUND} If the order doesn’t exist
 * @rejects {EXTERNAL_SERVICE_ERROR} On DB write failure
 */
export async function updateOrderDB(id, updatedOrder) {
  ensureInitDb(); // throws or rejects if Firebase isn’t ready


  if (!useRealtimeDB()) {
    return Promise.reject(
      errors.EXTERNAL_SERVICE_ERROR("Firestore update not implemented yet")
    );
  }

  const db = getRealtimeDB();
  const ref = db.ref(`/orders/${id}`);
  const snap = await ref.once("value");

  if (!snap.exists()) {
    return Promise.reject(errors.NOT_FOUND(`Order "${id}" not found`));
  }

  return ref
    .set(updatedOrder) // overwrite with prepared object
    .then(() => ({ id: id, ...updatedOrder }))
    .catch((err) =>
      Promise.reject(
        errors.EXTERNAL_SERVICE_ERROR("Failed to update order in Firebase", {
          original: err?.message ?? String(err),
        })
      )
    );
}


//Stocks
/**
 * Get all Stocks (RTDB depending on env).
 *
 * @returns {Promise<Object[]>} Array of Stocks Int.
 * @rejects {EXTERNAL_SERVICE_ERROR} If DB call fails.
 */
export async function getStocks() {
  const init = ensureInitDb();
  if (init) return init; // ensureInitDb may return a rejected promise

  if (useRealtimeDB()) {
    const db = getRealtimeDB();
    return db
      .ref("/stock")
      .once("value")
      .then((snap) => snap.val() || {})
      .then((val) => Object.entries(val).map(([id, data]) => ({ id, ...data })))
      .catch((err) =>
        Promise.reject(errors.EXTERNAL_SERVICE_ERROR("Failed to read orders from DB", { original: err }))
      );
  }

  return Promise.resolve([]);
}