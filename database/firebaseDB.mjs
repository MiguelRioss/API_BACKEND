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
  const payload = { ...orderData, createdAt };  // <-- define once, in scope
  let applied = []; // for rollback

  try {
    if (!useRealtimeDB()) {
      return Promise.reject(
        errors.EXTERNAL_SERVICE_ERROR("Firestore create not implemented yet")
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
      errors.EXTERNAL_SERVICE_ERROR("Failed to write order to DB", { original: err })
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
 * @returns {Promise<Object[]>} Applied decrements { stockId, qty }
 */
// database/firebaseDB.mjs

export async function findStockAndDecrement(stockSnapshot, orderData) {
  console.log("[findStockAndDecrement] start");
  console.log("[findStockAndDecrement] stockSnapshot size:", Array.isArray(stockSnapshot) ? stockSnapshot.length : "n/a");
  console.log("[findStockAndDecrement] orderData.items:", JSON.stringify(orderData?.items, null, 2));

  if (!orderData?.items || !Array.isArray(orderData.items)) {
    console.warn("[findStockAndDecrement] no items in orderData; nothing to do");
    return;
  }

  const updatedItems = []; // for rollback

  try {
    for (const item of orderData.items) {
      const rawId = item?.id;
      const rawQty = item?.quantity;
      const stockId = Number(rawId);
      const qty = Number(rawQty);

      console.log("[findStockAndDecrement] → candidate", {
        rawId, rawQty, stockId, qty,
      });

      if (!Number.isFinite(stockId)) {
        throw new Error(`BAD_STOCK_ID:${rawId}`);
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error(`BAD_QTY:${rawQty} for stockId=${stockId}`);
      }

      const found = stockSnapshot.find((s) => Number(s.id) === stockId);
      if (!found) {
        console.warn(`[findStockAndDecrement] STOCK_NOT_FOUND in snapshot for id=${stockId}`);
        throw new Error(`STOCK_NOT_FOUND:${stockId}`);
      }

      console.log("[findStockAndDecrement] found:", found);

      const newStockValue = Number(found.stockValue) - qty;
      console.log(
        `[findStockAndDecrement] compute: id=${stockId} current=${found.stockValue} - qty=${qty} => new=${newStockValue}`
      );

      if (!Number.isFinite(newStockValue) || newStockValue < 0) {
        console.warn(
          `[findStockAndDecrement] INSUFFICIENT_STOCK: id=${stockId} current=${found.stockValue} requested=${qty}`
        );
        throw new Error(`INSUFFICIENT_STOCK:${stockId}`);
      }

      // Write to DB (overwrite only name + stockValue as requested)
      console.log(
        `[findStockAndDecrement] updating DB for id=${stockId} → { name:"${found.name}", stockValue:${newStockValue} }`
      );
      await updateStock(stockId, {
        name: found.name,
        stockValue: newStockValue,
      });
      console.log(`[findStockAndDecrement] ✅ updated id=${stockId} to stockValue=${newStockValue}`);

      // Remember old value for rollback
      updatedItems.push({
        stockId,
        prev: Number(found.stockValue),
        name: found.name,
      });
    }

    console.log("[findStockAndDecrement] success; applied decrements:", updatedItems);
    return updatedItems;
  } catch (err) {
    console.error("[findStockAndDecrement] ERROR:", err);

    // Rollback any applied updates (best-effort)
    for (const u of updatedItems.reverse()) {
      try {
        console.log(
          `[findStockAndDecrement] rollback: id=${u.stockId} → restore stockValue=${u.prev}`
        );
        await updateStock(u.stockId, { name: u.name, stockValue: u.prev });
        console.log(`[findStockAndDecrement] ✅ rollback ok for id=${u.stockId}`);
      } catch (rbErr) {
        console.warn(
          `[findStockAndDecrement] ⚠️ rollback failed for id=${u.stockId}:`,
          rbErr?.message || rbErr
        );
      }
    }

    throw err;
  } finally {
    console.log("[findStockAndDecrement] end");
  }
}












