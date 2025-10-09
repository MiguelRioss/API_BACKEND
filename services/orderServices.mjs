// api/services/ordersServiceFactory.mjs

import {
  filterByStatus,
  filterByQuery,
  sortByWrittenAtDesc,
  applyLimit,
  validateAndPrepareOrder,
  mergeOrderChanges,
  validateAndNormalizeID,
} from "./servicesUtils.mjs";

/**
 * createOrdersService(db, emailService)
 * - db must expose:
 *    - async getAllOrders(): Promise<Array>
 *    - optional async getOrderById(id): Promise<Object|null>
 *    - async createOrderDB(order): Promise<Object>
 *    - optional async updateOrderDB(id, order): Promise<Object>
 *
 * Service throws domain errors for HTTP layer to map.
 */
export default function createOrdersService(db, emailService) {
  if (!db || typeof db.createOrderDB !== "function") {
    throw new Error("OrdersService requires a db with createOrderDB()");
  }

  const mailer =
    emailService && typeof emailService.sendOrderInvoiceEmail === "function"
      ? emailService
      : null;

  if (!mailer) {
    console.warn("[ordersService] emailService missing or invalid; invoice emails disabled.");
  }

  return {
    getOrdersServices,
    getOrderByIdServices,
    createOrderServices,
    updateOrderServices,
  };

  async function getOrdersServices({ limit, status, q } = {}) {
    return db
      .getAllOrders()
      .then((orders) => filterByStatus(orders, status))
      .then((orders) => filterByQuery(orders, q))
      .then((orders) => sortByWrittenAtDesc(orders))
      .then((orders) => applyLimit(orders, limit));
  }

  async function getOrderByIdServices(id) {
    const normalizedID = await validateAndNormalizeID(id);
    return db.getOrderById(normalizedID);
  }

  async function createOrderServices(order) {
    const prepared = await validateAndPrepareOrder(order);
    const saved = await db.createOrderDB(prepared);

    if (!mailer) {
      return saved;
    }

    const live = process.env.NODE_ENV === "production";
    try {
      await mailer.sendOrderInvoiceEmail({
        order: saved,
        orderId: saved?.id,
        live,
      });
      ´
      
      const flagged = { ...saved, email_sent_Order: true };
      if (typeof db.updateOrderDB === "function" && saved?.id) {
        try {
          await db.updateOrderDB(saved.id, flagged);
        } catch (updateErr) {
          console.warn(
            "[ordersService] Failed to persist email_sent flag:",
            updateErr?.message || updateErr
          );
        }
      }

      return flagged;
    } catch (err) {
      console.error("[ordersService] Failed to send invoice email:", err?.message || err);
      return saved;
    }
  }

  async function updateOrderServices(orderID, orderChanges = {}) {
    return validateAndNormalizeID(orderID).then((normalizedId) =>
      db.getOrderById(normalizedId).then((existingOrder) => {
        const updated = mergeOrderChanges(existingOrder, orderChanges);
        updated.updatedAt = new Date().toISOString();
        return db.updateOrderDB(normalizedId, updated);
      })
    );
  }
}
