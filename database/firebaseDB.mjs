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
 * @returns {Promise<Object>} The found order (with id property).
 * @rejects {NOT_FOUND} If order doesn't exist.
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
  const init = ensureInitDb();
  if (init) return init;

  const createdAt = new Date().toISOString();
  const payload = { ...orderData, createdAt };

  try {
    if (!useRealtimeDB()) {
      // If you later add Firestore, handle it here
      return Promise.reject(
        errors.EXTERNAL_SERVICE_ERROR("Firestore create not implemented yet")
      );
    }

    const db = getRealtimeDB();

    const stock = await getStocks()
    console.log("calling findStockAndDecrement…");
    await (stock, orderData);

    // ---- STOCK DECREMENT (normalized items) ----
    // Expecting orderData.items: Array<{ stockId: string, qty: number }>


    // ---- WRITE ORDER ----
    try {
      if (payload.id != null) {
        const key = String(payload.id);
        await db.ref(`/orders/${key}`).set(payload);
        return { id: key, ...payload };
      } else {
        const newRef = db.ref("/orders").push();
        await newRef.set(payload);
        return { id: newRef.key, ...payload };
      }
    } catch (err) {
      // Roll back stock if writing the order fails
      await rollbackBatch(db, decremented);
      return Promise.reject(
        errors.EXTERNAL_SERVICE_ERROR("Failed to write order to DB", {
          original: err,
        })
      );
    }
  } catch (err) {
    return Promise.reject(
      errors.EXTERNAL_SERVICE_ERROR("Failed to write order to DB", {
        original: err,
      })
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
      .then((val) => Object.entries(val).map(([id, data]) => ({ id: Number(id), name: data.name, stockValue: data.stockValue })))
      .catch((err) =>
        Promise.reject(errors.EXTERNAL_SERVICE_ERROR("Failed to read orders from DB", { original: err }))
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
 * @rejects {NOT_FOUND} If the order doesn’t exist
 * @rejects {EXTERNAL_SERVICE_ERROR} On DB write failure
 */
export async function updateStock(id, updatedStock) {
  ensureInitDb(); // throws or rejects if Firebase isn’t ready


  if (!useRealtimeDB()) {
    return Promise.reject(
      errors.EXTERNAL_SERVICE_ERROR("Firestore update not implemented yet")
    );
  }

  const db = getRealtimeDB();
  const ref = db.ref(`/stock/${id}`);
  const snap = await ref.once("value");

  if (!snap.exists()) {
    return Promise.reject(errors.NOT_FOUND(`Order "${id}" not found`));
  }

  return ref
    .set(updatedStock) // overwrite with prepared object
    .then(() => ({ id: id, ...updatedStock }))
    .catch((err) =>
      Promise.reject(
        errors.EXTERNAL_SERVICE_ERROR("Failed to update order in Firebase", {
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
 * @rejects {NOT_FOUND} If order doesn’t exist.
 */
export async function getStockByID(idStr) {
  const init = ensureInitDb();
  if (init) return init;

  if (useRealtimeDB()) {
    const db = getRealtimeDB();
    const id = String(idStr).trim();
    console.log("[getStockByID] looking up stock ID:", id);

    const snap = await db.ref(`/stock/${id}`).once("value");
    const val = snap.val();

    if (val === null || typeof val === "undefined") {
      return Promise.reject(errors.NOT_FOUND(`Stock ${id} not found`));
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
 * @returns {Promise<void>}
 */
export async function findStockAndDecrement(stockSnapshot, orderData) {
  if (!orderData?.items || !Array.isArray(orderData.items)) return;
  const init = ensureInitDb();
  if (init) return init;

  // Track applied decrements for rollback
  const applied = [];

  try {
    for (const item of orderData.items) {
      const stockId = Number(item.id);
      const qty = Number(item.quantity);

      // Optional guard using the snapshot (not required for correctness)
      const found = stockSnapshot.find((s) => s.id === stockId);
      if (!found) {
        console.warn(`[findStockAndDecrement] Stock ID ${stockId} not found in snapshot`);
        // You can choose to continue or throw. Continuing here:
        continue;
      }

      // Concurrency-safe decrement: only /stock/{id}/stockValue changes
      await txnDecrementStockValue(stockId, qty);
      applied.push({ stockId, qty });

      console.log(`[findStockAndDecrement] decremented stock ${stockId} by ${qty}`);
    }
  } catch (err) {
    console.error("[findStockAndDecrement] Error occurred:", err);

    // Best-effort rollback of previously applied decrements
    for (const x of applied.reverse()) {
      try {
        await txnIncrementStockValue(x.stockId, x.qty);
        console.log(`[findStockAndDecrement] rolled back stock ${x.stockId} by +${x.qty}`);
      } catch (rbErr) {
        console.warn("[findStockAndDecrement] rollback failed:", rbErr);
      }
    }
    throw err; // let caller handle
  }
}


/**
 * Atomically decrement stockValue by qty. Rejects if insufficient.
 */
function txnDecrementStockValue(stockId, qty) {
  const db = getRealtimeDB();
  const ref = db.ref(`/stock/${stockId}/stockValue`);

  return new Promise((resolve, reject) => {
    ref.transaction(
      (current) => {
        if (typeof current !== "number") return;     // abort (invalid node)
        const next = current - qty;
        if (next < 0) return;                         // abort (insufficient)
        return next;                                  // commit
      },
      (err, committed, snap) => {
        if (err) return reject(err);
        if (!committed) return reject(new Error(`INSUFFICIENT_STOCK:${stockId}`));
        resolve(snap?.val()); // new value
      },
      false
    );
  });
}

/**
 * Atomically increment stockValue by qty (used for rollback).
 */
function txnIncrementStockValue(stockId, qty) {
  const db = getRealtimeDB();
  const ref = db.ref(`/stock/${stockId}/stockValue`);

  return new Promise((resolve, reject) => {
    ref.transaction(
      (current) => {
        if (typeof current !== "number") return qty;  // create if missing
        return current + qty;
      },
      (err, committed, snap) => {
        if (err) return reject(err);
        if (!committed) return reject(new Error(`ROLLBACK_FAILED:${stockId}`));
        resolve(snap?.val());
      },
      false
    );
  });
}
