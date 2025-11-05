// api/services/ordersServiceFactory.mjs
const DEFAULT_SUCCESS_URL = `${process.env.PUBLIC_BASE_URL}/checkout/orderSuccess`;

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

// ─────────────────────────────────────────────
// Folder validation helpers
// ─────────────────────────────────────────────
const ALLOWED_FOLDERS = new Set(["orders", "archive", "deleted"]);
function normalizeFolderName(raw) {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (v === "archived") return "archive"; // accept synonym
  if (ALLOWED_FOLDERS.has(v)) return v;
  return null;
}
function assertFolderName(raw, what = "folder") {
  const norm = normalizeFolderName(raw);
  if (!norm) {
    throw errors.invalidData(
      `Invalid ${what} '${raw}'. Allowed: orders | archive | deleted`
    );
  }
  return norm;
}

/**
 * createOrdersService(db, stripeServices, emailService, stockServices)
 */
export default function createOrdersService(
  db,
  stripeServices,
  emailService,
  stockServices
) {
  if (!db || typeof db.createOrderDB !== "function") {
    return errors.externalService(
      "OrdersService requires a db with createOrderDB()"
    );
  }
  if (!stripeServices) {
    return errors.internalError("OrdersService requires a stripeServices");
  }
  if (!emailService) {
    return errors.internalError(
      "[ordersService] emailService missing or invalid; invoice emails disabled."
    );
  }

  return {
    getOrdersServices,
    getOrderByIdServices,
    getOrderByStripeSessionId,
    createOrderServices,
    updateOrderServices,
    createCheckoutSession,
    getOrdersByFolderService,
    // NEW:
    moveOrdersService,
    moveOrderService,
  };

  // ──────────────────────────────
  // READ
  // ──────────────────────────────
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

  async function getOrdersByFolderService(folderName) {
    const folder = assertFolderName(folderName, "folder name");
    if (typeof db.getAllOrdersByFolder !== "function") {
      throw errors.externalService(
        "DB adapter missing getOrdersByFolder(folder)"
      );
    }
    return db.getAllOrdersByFolder(folder);
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
  // CHECKOUT DECISION (Stripe vs manual)
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

    const stripeAllowed = [
      "PT",
      "PORTUGAL",
      "DE",
      "GERMANY",
      "NL",
      "NETHERLANDS",
      "MX",
      "MEXICO",
      "CA",
      "CANADA",
      "AU",
      "AUSTRALIA",
      "NZ",
      "NEW ZEALAND",
      "ZA",
      "SOUTH AFRICA",
    ];

    const normalizedCountry = (country || "").trim().toUpperCase();
    console.log("[ordersService] Checkout initiated for", normalizedCountry);

    if (stripeAllowed.includes(normalizedCountry)) {
      return stripeServices.createCheckoutSession(orderData);
    }

    const catalog = await stockServices.getAllProducts();
    const otherCountryOrderPayload = await buildManualOrderFromCart({
      ...orderData,
      currency: orderData.currency || "eur",
      paymentId: orderData.paymentId,
      catalog,
    });

    const savedOrder = await createOrderServices(otherCountryOrderPayload, {
      isRequestedOrderForOtherCountries: true,
    });

    return { url: `${DEFAULT_SUCCESS_URL}/${savedOrder.id}` };
  }

  // ──────────────────────────────
  // CREATE + EMAILS
  // ──────────────────────────────
  async function createOrderServices(order, options = {}) {
    const { isRequestedOrderForOtherCountries = false } = options;

    const prepared = await validateAndPrepareOrder(order, {
      isRequestedOrderForOtherCountries,
    });

    const saved = await db.createOrderDB(prepared);

    if (!emailService) {
      console.warn(
        "[ordersService] No email service available, skipping emails."
      );
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
          payment_status: false,
        };
      } else {
        await emailService.sendOrderBundleEmails({
          order: saved,
          orderId: saved.id,
        });
        flagged = {
          ...saved,
          email_Sent_ThankYou_Admin: true,
          payment_status: true,
        };
      }

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

  // ──────────────────────────────
  // UPDATE
  // ──────────────────────────────
  async function updateOrderServices(orderID, orderChanges = {}) {
    return validateAndNormalizeID(orderID).then((normalizedId) =>
      db.getOrderById(normalizedId).then((existingOrder) => {
        const updated = mergeOrderChanges(existingOrder, orderChanges);
        updated.updatedAt = new Date().toISOString();
        return db.updateOrderDB(normalizedId, updated);
      })
    );
  }

  // ──────────────────────────────
  // NEW: MOVE (bulk + single), with folder validation
  // ──────────────────────────────
  async function moveOrdersService({ ids, source, dest }) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw errors.invalidData("You must provide a non-empty array of ids.");
    }

    const fromFolder = assertFolderName(source, "source folder");
    const toFolder = assertFolderName(dest, "destination folder");

    if (fromFolder === toFolder) {
      return {
        moved: 0,
        skipped: [...ids],
        source: fromFolder,
        dest: toFolder,
      };
    }

    // Prefer bulk DB op if present; else fall back to single
    if (typeof db.moveOrdersBetweenFolders === "function") {
      return db.moveOrdersBetweenFolders(ids, fromFolder, toFolder);
    }

    if (typeof db.moveOrderBetweenFolders === "function") {
      const results = await Promise.allSettled(
        ids.map((id) => db.moveOrderBetweenFolders(id, fromFolder, toFolder))
      );
      const moved = results.filter((r) => r.status === "fulfilled").length;
      const skipped = results
        .map((r, i) => (r.status === "fulfilled" ? null : ids[i]))
        .filter(Boolean);
      return { moved, skipped, source: fromFolder, dest: toFolder };
    }

    throw errors.externalService(
      "DB adapter missing moveOrdersBetweenFolders(ids, from, to) or moveOrderBetweenFolders(id, from, to)"
    );
  }

  async function moveOrderService({ id, source, dest }) {
    const ids = [await validateAndNormalizeID(id)];
    return moveOrdersService({ ids, source, dest });
  }
}
