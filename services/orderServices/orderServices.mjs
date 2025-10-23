// api/services/ordersServiceFactory.mjs
const DEFAULT_SUCCESS_URL =
  `${process.env.PUBLIC_BASE_URL}/checkout/orderSuccess`;

import errors from "../../errors/errors.mjs";
import {
  filterByStatus,
  filterByQuery,
  sortByWrittenAtDesc,
  applyLimit,
  validateAndPrepareOrder,
  mergeOrderChanges,
  validateAndNormalizeID,
  normalizeId,
} from "../servicesUtils.mjs";
import buildManualOrderFromCart from "./orderServicesUtils.mjs";

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
export default function createOrdersService(db, stripeServices, emailService, stockServices) {
  if (!db || typeof db.createOrderDB !== "function") {
    return errors.externalService("OrdersService requires a db with createOrderDB()");
  }
  if (!stripeServices) {
    return errors.internalError("OrdersService requires a stripeServices");
  }

  if (!emailService) {
    return errors.internalError("[ordersService] emailService missing or invalid; invoice emails disabled.");
  }

  return {
    getOrdersServices,
    getOrderByIdServices,
    getOrderByStripeSessionId,
    createOrderServices,
    updateOrderServices,
    createCheckoutSession
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

  async function getOrderByStripeSessionId(sessionId) {
    if (sessionId === null || typeof sessionId === "undefined") {
      return Promise.reject(
        errors.invalidData("You must provide a Stripe session id.")
      );
    }

    const normalized = normalizeId(sessionId);
    if (!normalized) {
      return Promise.reject(
        errors.invalidData("Stripe session id cannot be empty.")
      );
    }

    if (typeof db.getOrderByStripeSessionId === "function") {
      return db.getOrderByStripeSessionId(normalized);
    }
  }


  // ──────────────────────────────
  // STEP 1: Decide Stripe vs Request-Order
  // ──────────────────────────────
  async function createCheckoutSession(orderData) {
    const {
      shippingAddress = {},
      billingAddress = {},
      customer = {},
    } = orderData;

    const country =
      shippingAddress.country?.toUpperCase?.() ||
      billingAddress.country?.toUpperCase?.() ||
      customer.country?.toUpperCase?.();

    if (!country) {
      throw errors.invalidData("Country is required to process checkout");
    }

    // 🌍 Allowable Stripe countries (by both code and full name)
    const stripeAllowed = [
      "PT", "PORTUGAL",
      "DE", "GERMANY",
      "NL", "NETHERLANDS",
      "MX", "MEXICO",
      "CA", "CANADA",
      "AU", "AUSTRALIA",
      "NZ", "NEW ZEALAND",
      "ZA", "SOUTH AFRICA"
    ];

    // Normalize the input for matching (uppercase, trim)
    const normalizedCountry = (country || "").trim().toUpperCase();

    console.log("[ordersService] Checkout initiated for", normalizedCountry);

    if (stripeAllowed.includes(normalizedCountry)) {
      // 💳 Stripe route
      return stripeServices.createCheckoutSession(orderData);
    }

    // 🌍 Other-country request (no Stripe)
    const catalog = await stockServices.getAllProducts();

    const otherCountryOrderPayload = await buildManualOrderFromCart({
      ...orderData,
      currency: orderData.currency || "eur",
      paymentId: orderData.paymentId,
      catalog,
    });

    // ✅ Create the order directly in DB (request-for-order flow)
    const savedOrder = await createOrderServices(otherCountryOrderPayload, {
      isRequestedOrderForOtherCountries: true,
    });

    return { url: `${DEFAULT_SUCCESS_URL}/${savedOrder.id}` };
  }





  // ──────────────────────────────
  // STEP 2: Create Order + Emails
  // ──────────────────────────────
  async function createOrderServices(order, options = {}) {
    const { isRequestedOrderForOtherCountries = false } = options;

    console.log(
      "[ordersService] Creating order:",
      order,
      "Requested for other country:",
      isRequestedOrderForOtherCountries
    );

    // Pass the flag into validation (as an object for clarity)
    const prepared = await validateAndPrepareOrder(order, {
      isRequestedOrderForOtherCountries,
    });

    const saved = await db.createOrderDB(prepared);

    if (!emailService) {
      console.warn("[ordersService] No email service available, skipping emails.");
      return saved;
    }

    let flagged = {};

    try {
      if (isRequestedOrderForOtherCountries) {

        await emailService.sendInquiryOrderBundleEmails({
          order: saved,
          orderId: saved.id,
          manual: true,
        });


        flagged = {
          ...saved,
          email_Sent_ThankYou_Admin: false,
          payment_status: false, // ❌ Not yet paid — awaiting manual payment
        };
      } else {
        // 💳 Stripe / standard checkout flow (immediate payment)
        await emailService.sendOrderBundleEmails({ order: saved, orderId: saved.id});

        flagged = {
          ...saved,
          email_Sent_ThankYou_Admin: true,
          payment_status: true, // ✅ Paid immediately
        };
      }

      // Persist updated flags in DB
      if (typeof db.updateOrderDB === "function" && saved?.id) {
        try {
          await db.updateOrderDB(saved.id, flagged);
        } catch (updateErr) {
          console.warn(
            "[ordersService] Failed to persist flag updates:",
            updateErr?.message || updateErr
          );
        }
      }

      return flagged;
    } catch (err) {
      console.error(
        "[ordersService] Failed to send order emails:",
        err?.message || err
      );
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
