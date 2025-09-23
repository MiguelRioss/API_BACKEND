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
      console.log(orders)

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
      // validate id (throws ValidationError on bad input)
      validateIdOrThrow(id);

      // fast-path: prefer adapter direct lookup when available
      if (typeof db.getOrderById === "function") {
        const direct = await db.getOrderById(id);
        if (direct) return direct;
        // otherwise continue to fallback search
      }

      // fallback: scan all orders and use validator matching
      const all = await db.getAllOrders();
      const found = findOrderById(all, id);
      if (found) return found;

      // Not found -> domain error
      throw new NotFoundError(`Order ${String(id).trim()} not found`);
    } catch (err) {
      if (err instanceof DomainError) throw err;
      throw new ExternalServiceError("Failed looking up order", { original: err?.message ?? String(err) });
    }
  }


  // -------------------------
  // createOrderServices: validate, prepare and persist an order
  // -------------------------
  async function createOrderServices(orderObject) {
    try {
      // 1) validate & prepare (throws ValidationError on bad input)
      const prepared = validateAndPrepareOrder(orderObject);

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
