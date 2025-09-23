// api/services/ordersServiceFactory.mjs
import {
  DomainError,
  ValidationError,
  NotFoundError,
  ExternalServiceError,
} from "../errors/domainErros.mjs";

import {
  validateIdOrThrow,
  findOrderById,
  filterByStatus,
  filterByQuery,
  sortByWrittenAtDesc,
  applyLimit,
  validateAndPrepareOrder
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
  if (!db || typeof db.getAllOrders !== "function") {
    throw new Error("createOrdersService requires a db module with at least getAllOrders()");
  }

  return {
    getOrdersServices,
    getOrderByIdServices,
    createOrderServices
  };

  // -------------------------
  // getOrdersServices: supports optional filters
  // { limit, status, q }
  // ------------------------

  async function getOrdersServices({ limit, status, q } = {}) {
    try {
      let orders = await db.getAllOrders();
      if (!Array.isArray(orders)) orders = [];

      // Compose the pure helpers
      orders = filterByStatus(orders, status);

      orders = filterByQuery(orders, q);
      orders = sortByWrittenAtDesc(orders);
      orders = applyLimit(orders, limit);

      return orders;
    } catch (err) {
      throw new ExternalServiceError("Failed to read orders from DB", {
        original: err?.message ?? String(err),
      });
    }
  }


  // -------------------------
  // getOrderByIdServices: flexible lookup (uses servicesUtils)
  // -------------------------
 async function getOrderByIdServices(id) {
  try {
    // 1) validate input (throws ValidationError -> DomainError if invalid)
    validateIdOrThrow(id);

    // 2) normalise to a trimmed string for the DB layer
    //    - this prevents numeric/string mismatch and removes accidental spaces
    const idStr = String(id).trim();

    // Optional: ensure idStr not empty after trim
    if (idStr.length === 0) {
      throw new Error('getOrderByIdServices: normalized id is empty');
    }

    // 3) prefer adapter direct lookup (adapter should expect a string)
    if (typeof db.getOrderById === 'function') {
      const direct = await db.getOrderById(idStr);
      if (direct) return direct;
      // if adapter returns falsy, fallthrough to explicit NotFound
    }

    // 4) if no adapter or not found, explicit NotFoundError
    throw new NotFoundError(`Order ${idStr} not found`);
  } catch (err) {
    // preserve domain errors by code or instanceof
    if (err && (err instanceof NotFoundError || err.code === 'NOT_FOUND')) throw err;
    if (err && (err instanceof DomainError || err.code === 'VALIDATION_ERROR')) throw err;

    // wrap unexpected errors for the upstream layer
    const origDetail = err && (err.message || err.stack || String(err));
    throw new ExternalServiceError('Failed looking up order', { original: origDetail });
  }
}

  // -------------------------
  // createOrderServices: validate, prepare and persist an order
  // -------------------------
  async function createOrderServices(orderObject) {
    try {
      // 1) validate & prepare (throws ValidationError on bad input)
      const prepared = validateAndPrepareOrder(orderObject);

      console.log(prepared)
      // 2) ensure DB supports create
      if (typeof db.createOrderDB !== "function") {
        throw new ExternalServiceError("DB adapter does not support createOrderDB");
      }

      // 3) persist (pass key explicitly to keep adapter dumb)
      // The DB adapter is expected to just store whatever it receives.
      const result = await db.createOrderDB(prepared, prepared.event_id);

      // return the stored order (service-level contract)
      return result;
    } catch (err) {
      // rethrow domain errors unchanged so HTTP layer maps them
      if (err instanceof DomainError) throw err;
      // unexpected errors -> wrap as ExternalServiceError
      throw new ExternalServiceError("Failed creating order", { original: err?.message ?? String(err) });
    }
  }
}
