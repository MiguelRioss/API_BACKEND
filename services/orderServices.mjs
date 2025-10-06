// api/services/ordersServiceFactory.mjs

import {
  filterByStatus,
  filterByQuery,
  sortByWrittenAtDesc,
  applyLimit,
  validateAndPrepareOrder,
  mergeOrderChanges,
  validateAndNormalizeID,
  normalizeId
} from "./servicesUtils.mjs";


/**
 * createOrdersService(db)
 * - db must expose:
 *    - async getAllOrders(): Promise<Array>
 *    - optional async getOrderById(id): Promise<Object|null>
 *
 * Returns:
 *  - getOrdersServices({ limit, status, q })
 *  - getOrderByIdServices(id)
 *
 * Service throws domain errors for HTTP layer to map.
 */
export default function createOrdersService(db) {
  if (!db) {
    throw "Services dependency invalid";
  }

  return {
    getOrdersServices,
    getOrderByIdServices,
    createOrderServices,
    updateOrderServices
  };
  /**
  * Fetches orders and applies filters, sorting, and limit in a chained style.
  *
  * @async
  * @param {Object} [options]
  * @param {number} [options.limit] - Maximum number of orders.
  * @param {string|boolean} [options.status] - Status filter.
  * @param {string} [options.q] - Query string.
  * @returns {Promise<Object[]>} Filtered, sorted, and limited orders.
  */
  async function getOrdersServices({ limit, status, q } = {}) {
    return db.getAllOrders()
      .then(orders => filterByStatus(orders, status))
      .then(orders => filterByQuery(orders, q))
      .then(orders => sortByWrittenAtDesc(orders))
      .then(orders => applyLimit(orders, limit));
  }

  /**
   * Retrieves an order by its ID after validation and normalization.
   *
   * @async
   * @function getOrderByIdServices
   * @param {string|number} id - The raw id provided by the caller.
   * @returns {Promise<Object|null>} Resolves with the order object if found, or null if not found.
   * @rejects {VALIDATIONn} If the id is null, undefined, or empty after trimming.
   */
  async function getOrderByIdServices(id) {
    const normalizedID = await validateAndNormalizeID(id);
    return db.getOrderById(normalizedID);
  }

  /**
   * Creates a new order in the database.
   *
   * Workflow:
   * 1. Validates and normalizes the input order.
   * 2. Generates IDs, status, metadata, etc.
   * 3. Persists the prepared order to the database.
   *
   * @async
   * @function createOrderServices
   * @param {Object} order - Raw order object to be validated and saved.
   * @returns {Promise<Object>} Resolves with the created order as stored in the database.
   * @rejects {ValidationError} If the order payload is invalid.
   * @rejects {ExternalServiceError} If the DB call fails.
   */
  async function createOrderServices(order) {
    const prepared = await validateAndPrepareOrder(order); // ← await needed here
    return db.createOrderDB(prepared);
  }


  /**
  * Update an existing order by applying changes and persisting to DB.
  *
  * @async
  * @param {string|number} orderID - The id of the order to update.
  * @param {Object} orderChanges - Fields to merge into the order.
  * @returns {Promise<Object>} The updated order as persisted in the DB.
  * @throws {ValidationError} If the order ID is invalid.
  * @throws {NotFoundError} If the order does not exist.
  * @throws {ExternalServiceError} If the DB operation fails.
  */
  async function updateOrderServices(orderID, orderChanges = {}) {
    return validateAndNormalizeID(orderID)
      .then(normalizedId =>
        db.getOrderById(normalizedId).then(existingOrder => {
          const updated = mergeOrderChanges(existingOrder, orderChanges);
          updated.updatedAt = new Date().toISOString();
          return db.updateOrderDB(normalizedId, updated);
        })
      );
  }
}

//Stock

/**
 * Decrement a single stock by qty using a transaction that prevents negative values.
 * Throws Error('INSUFFICIENT_STOCK:<stockId>') if the transaction would go below zero.
 */
function txnDecrementStock(db, stockId, qty) {
  return new Promise((resolve, reject) => {
    const ref = db.ref(`/stock/${stockId}/stockValue`);
    ref.transaction(
      (current) => {
        if (typeof current !== "number") return; // abort: invalid/missing stock
        const next = current - qty;
        if (next < 0) return; // abort: insufficient
        return next;
      },
      (err, committed, snap) => {
        if (err) return reject(err);
        if (!committed) return reject(new Error(`INSUFFICIENT_STOCK:${stockId}`));
        resolve(snap?.val());
      },
      false
    );
  });
}

/** Increment a single stock by qty (used for rollback). */
function txnIncrementStock(db, stockId, qty) {
  return new Promise((resolve, reject) => {
    const ref = db.ref(`/stock/${stockId}/stockValue`);
    ref.transaction(
      (current) => (typeof current === "number" ? current + qty : qty),
      (err, committed, snap) => {
        if (err) return reject(err);
        if (!committed) return reject(new Error(`ROLLBACK_FAILED:${stockId}`));
        resolve(snap?.val());
      },
      false
    );
  });
}

/** Best-effort rollback of a batch of decrements. */
async function rollbackBatch(db, decremented) {
  for (const { stockId, qty } of decremented) {
    try { await txnIncrementStock(db, stockId, qty); } catch {}
  }
}



