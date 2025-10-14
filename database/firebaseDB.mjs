// database/firebaseDB.mjs
import "dotenv/config"; // dotenv is idempotent
import { initFirebase, getFirestore, getRealtimeDB, useRealtimeDB } from "./firebase/firebaseInit.mjs";
import errors from "../errors/errors.mjs"; // <- use your ApplicationError style
import { isObj, canonStatusKey, STATUS_KEYS } from "./firebase/utilsDB.mjs";

const normalizeId = (value) => String(value ?? "").trim();

/**
 * Ensure Firebase is initialized before any db operation.
 * Wraps init errors as externalService.
 */
function ensureInitDb() {
  try {
    initFirebase();
  } catch (err) {
    return Promise.reject(
      errors.externalService(`Firebase initialization failed: ${err?.message ?? err}`, {
        original: err,
      })
    );
  }
}

/**
 * Get all orders (RTDB or Firestore depending on env).
 *
 * @returns {Promise<Object[]>} Array of orders.
 * @rejects {externalService} If DB call fails.
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
        Promise.reject(errors.externalService("Failed to read orders from DB", { original: err }))
      );
  }

  return Promise.resolve([]);
}

/**
 * Get a single order by id.
 *
 * @param {string} idStr - Normalized order ID.
 * @returns {Promise<Object>} The found order (with id property).
 * @rejects {notFound} If order doesn't exist.
 */
export async function getOrderById(idStr) {
  const init = ensureInitDb();
  if (init) return init;

  if (useRealtimeDB()) {
    const db = getRealtimeDB();
    const snap = await db.ref(`/orders/${idStr}`).once("value");
    const val = snap.val();
    if (val === null || typeof val === "undefined") {
      return Promise.reject(errors.notFound(`Order ${idStr} not found`));
    }
    return { id: idStr, ...val };
  }
}


export async function getOrderByStripeSessionId(sessionId) {
  const orders = await getAllOrders();

  const order = orders.find((o, i) => { return o.session_id === sessionId });
  if (order) {
    return order;
  }
  throw errors.notFound(`Order with session_id "${sessionId}" not found`);
}

/**
 * Create a new order in the DB.
 *
 * @param {Object} orderData
 * @returns {Promise<Object>} The created order.
 */
export async function createOrderDB(orderData = {}) {
  const init = ensureInitDb();
  if (init) return init;

  const createdAt = new Date().toISOString();
  const payload = { ...orderData, createdAt };  // <-- define once, in scope
  let applied = []; // for rollback

  try {
    if (!useRealtimeDB()) {
      return Promise.reject(
        errors.externalService("Firestore create not implemented yet")
      );
    }

    const db = getRealtimeDB();

    // 1) Take a snapshot and decrement stock (using your working updateStock-based helper)
    const stockSnapshot = await getStocks();
    console.log("[createOrderDB] calling findStockAndDecrement");
    applied = (await findStockAndDecrement(stockSnapshot, orderData)) || [];

    // 2) Write order
    let result;
    if (payload.id != null) {
      const key = String(payload.id);
      await db.ref(`/orders/${key}`).set(payload);
      result = { id: key, ...payload };
    } else {
      const newRef = db.ref("/orders").push();
      await newRef.set(payload);
      result = { id: newRef.key, ...payload };
    }

    return result;
  } catch (err) {
    // 3) Rollback stock if order write failed after decrements
    if (applied.length) {
      console.warn("[createOrderDB] order write failed; rolling back stock…");
      for (const { stockId, prev, name } of applied.reverse()) {
        try {
          await updateStock(stockId, { name, stockValue: prev });
          console.log(`[createOrderDB] rollback ok for id=${stockId} → ${prev}`);
        } catch (rbErr) {
          console.warn(`[createOrderDB] rollback failed for id=${stockId}:`, rbErr?.message || rbErr);
        }
      }
    }

    return Promise.reject(
      errors.externalService("Failed to write order to DB", { original: err })
    );
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
 * @rejects {notFound} If the order doesn’t exist
 * @rejects {externalService} On DB write failure
 */
export async function updateOrderDB(id, updatedOrder) {
  ensureInitDb(); // throws or rejects if Firebase isn’t ready


  if (!useRealtimeDB()) {
    return Promise.reject(
      errors.externalService("Firestore update not implemented yet")
    );
  }

  const db = getRealtimeDB();
  const ref = db.ref(`/orders/${id}`);
  const snap = await ref.once("value");

  if (!snap.exists()) {
    return Promise.reject(errors.notFound(`Order "${id}" not found`));
  }

  return ref
    .set(updatedOrder) // overwrite with prepared object
    .then(() => ({ id: id, ...updatedOrder }))
    .catch((err) =>
      Promise.reject(
        errors.externalService("Failed to update order in Firebase", {
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
 * @rejects {externalService} If DB call fails.
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
      .then((val) => Object.entries(val).map(([id, data]) => ({ id: Number(id), name: data.title, stockValue: data.stockValue, price: data.priceInEuros })))
      .catch((err) =>
        Promise.reject(errors.externalService("Failed to read orders from DB", { original: err }))
      );
  }

  return Promise.resolve([]);
}


/**
 * Get all Products from DB.
 */
export async function getProducts() {
  const init = ensureInitDb();
  if (init) return init;

  if (useRealtimeDB()) {
    const db = getRealtimeDB();
    return db.ref("/stock")
      .once("value")
      .then((snap) => snap.val() || {})
      .then((val) =>
        Object.entries(val).map(([id, data]) => ({
          id: Number(id),
          ...data,
        }))
      );
  }
  return [];
}
/**
 * Update an order by replacing it with the provided object.
 * Same contract as localDB.updateOrderDB — service layer handles merging/normalization.
 *
 * @async
 * @param {string|number} id - Order ID
 * @param {Object} updatedOrder - Fully prepared order object
 * @returns {Promise<Object>} The updated order (with id included)
 * @rejects {notFound} If the order doesn’t exist
 * @rejects {externalService} On DB write failure
 */
export async function updateStock(id, updatedStock) {
  ensureInitDb(); // throws or rejects if Firebase isn’t ready


  if (!useRealtimeDB()) {
    return Promise.reject(
      errors.externalService("Firestore update not implemented yet")
    );
  }

  const db = getRealtimeDB();
  const ref = db.ref(`/stock/${id}`);
  const snap = await ref.once("value");

  if (!snap.exists()) {
    return Promise.reject(errors.notFound(`Order "${id}" not found`));
  }

  return ref
    .set(updatedStock) // overwrite with prepared object
    .then(() => ({ id: id, ...updatedStock }))
    .catch((err) =>
      Promise.reject(
        errors.externalService("Failed to update order in Firebase", {
          original: err?.message ?? String(err),
        })
      )
    );
}

/**
 * Get a single order by id.
 *
 * @param {string} idStr - Normalized order ID.
 * @returns {Promise<Object>} The found order.
 * @rejects {notFound} If order doesn’t exist.
 */
export async function getStockByID(idStr) {
  const init = ensureInitDb();
  if (init) return init;

  if (useRealtimeDB()) {
    const db = getRealtimeDB();
    const id = String(idStr).trim();

    const snap = await db.ref(`/stock/${id}`).once("value");
    const val = snap.val();

    if (val === null || typeof val === "undefined") {
      return Promise.reject(errors.notFound(`Stock ${id} not found`));
    }

    return { id, ...val };
  }
}

/**
 * Find each stock item from the order and decrement stockValue ONLY.
 * Uses RTDB transactions; performs best-effort rollback on error.
 *
 * @param {Object[]} stockSnapshot - Current stock list from DB (id, name, stockValue)
 * @param {Object} orderData       - The order data (expects .items with {id, quantity})
 * @returns {Promise<Object[]>} Applied decrements { stockId, qty }
 */
// database/firebaseDB.mjs

// database/firebaseDB.mjs
export async function findStockAndDecrement(stockSnapshot, orderData) {
  if (!orderData?.items || !Array.isArray(orderData.items)) return [];
  const applied = [];
  console.log(stockSnapshot)

  for (const item of orderData.items) {
    const stockId = Number(item.id);

    const qty = Number(item.quantity);
    const found = stockSnapshot.find(s => Number(s.id) === stockId);
    console.log(found)
    if (!found) throw new Error(`STOCK_notFound:${stockId}`);

    const newVal = Number(found.stockValue) - qty;
    if (!Number.isFinite(newVal) || newVal < 0) throw new Error(`INSUFFICIENT_STOCK:${stockId}`);

    await updateStockValue(stockId, newVal);          // <-- only field-level update
    applied.push({ stockId, prev: Number(found.stockValue) });
  }
  return applied;
}












// database/firebaseDB.mjs
export async function updateStockValue(id, stockValue) {
  ensureInitDb();
  if (!useRealtimeDB()) throw errors.externalService("Firestore update not implemented yet");

  const db = getRealtimeDB();
  // PATCH the field (preserves all other product fields)
  await db.ref(`/stock/${id}`).update({ stockValue });
  return { id, stockValue };
}
