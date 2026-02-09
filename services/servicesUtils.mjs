// api/services/servicesUtils.mjs
import { randomUUID } from "node:crypto";
import errors from "../errors/errors.mjs";
import { PAYMENT_TYPE } from "./commonUtils.mjs";
import {
  makeDefaultStatus,
  assertValidStatusKey,
} from "./orderServices/orderStatus.mjs";

const allowedCurrencies = new Set(["eur", "usd", "gbp"]);

/*───────────────────────────────────────────────*/
/*  BASIC UTILITIES                              */
/*───────────────────────────────────────────────*/

export async function validateAndNormalizeID(id) {
  if (id === null || typeof id === "undefined") {
    return Promise.reject(
      errors.invalidData(
        `To create an Order you must provide a valid id, not ${id}`
      )
    );
  }

  const s = normalizeId(id);
  if (s === "") {
    return Promise.reject(
      errors.invalidData(`To create an Order you must provide a non-empty id`)
    );
  }

  return s;
}

export function normalizeId(id) {
  return String(id).trim();
}

export function candidateMatches(candidate, needle) {
  if (candidate === null || typeof candidate === "undefined") return false;
  const c = String(candidate);
  const n = String(needle);

  if (c === n) return true;

  const cNum = Number(c);
  const nNum = Number(n);
  return !Number.isNaN(cNum) && !Number.isNaN(nNum) && cNum === nNum;
}

export function orderMatchesId(order, needle) {
  if (!order || !needle) return false;
  const candidates = [
    order.event_id,
    order.id,
    order.session_id,
    order.metadata?.stripe_session_id,
    order.metadata?.order_id,
    order.metadata?.tracking_id,
  ];
  return candidates.some((c) => candidateMatches(c, needle));
}

export function findOrderById(ordersArray, id) {
  const needle = normalizeId(id);
  if (!Array.isArray(ordersArray) || ordersArray.length === 0) return null;
  return ordersArray.find((o) => orderMatchesId(o, needle)) || null;
}

export function findOrderBySessionId(ordersArray, sessionId) {
  const needle = normalizeId(sessionId);
  if (!needle || !Array.isArray(ordersArray) || ordersArray.length === 0) {
    return null;
  }

  return (
    ordersArray.find(
      (order) =>
        candidateMatches(order?.session_id, needle) ||
        candidateMatches(order?.metadata?.stripe_session_id, needle)
    ) || null
  );
}

export function filterByStatus(orders = [], status) {
  if (typeof status === "undefined") return orders;
  const want =
    typeof status === "boolean"
      ? status
      : String(status).toLowerCase() === "true";
  return orders.filter((o) => Boolean(o.status) === want);
}

export function filterByQuery(orders = [], q) {
  if (!q) return orders;
  const needle = String(q).toLowerCase();
  return orders.filter((o) => {
    const fields = [
      o?.event_id,
      o?.session_id,
      o?.name,
      o?.email,
      o?.amount_total != null ? String(o.amount_total) : null,
      o?.currency,
      o?.metadata?.full_name,
      o?.metadata?.shipping_address?.line1,
      o?.metadata?.shipping_address?.postal_code,
      o?.metadata?.billing_address?.line1,
    ];
    return fields.some((f) =>
      f ? String(f).toLowerCase().includes(needle) : false
    );
  });
}

export function sortByWrittenAtDesc(orders = []) {
  return orders.slice().sort((a, b) => {
    const aT = a?.written_at ?? "";
    const bT = b?.written_at ?? "";
    if (!aT && !bT) return 0;
    if (!aT) return 1;
    if (!bT) return -1;
    return aT > bT ? -1 : aT < bT ? 1 : 0;
  });
}

export function applyLimit(orders = [], limit) {
  if (!limit || !Number.isFinite(Number(limit))) return orders;
  return orders.slice(0, Number(limit));
}

/*───────────────────────────────────────────────*/
/*  ADDRESS + ITEM VALIDATION                    */
/*───────────────────────────────────────────────*/

function normalizeAddress(addr = {}) {
  if (typeof addr !== "object" || Array.isArray(addr)) return {};
  return {
    name: (addr.name ?? "").trim(),
    phone: (addr.phone ?? "").trim(),
    line1: (addr.line1 ?? "").trim(),
    line2: (addr.line2 ?? "").trim(),
    city: (addr.city ?? "").trim(),
    postal_code: (addr.postal_code ?? "").trim(),
    country: (addr.country ?? "").trim().toUpperCase(),
  };
}

/**
 * Validates and normalizes an array of order items.
 * Returns both normalized items and the MERCHANDISE subtotal (in cents).
 *
 * @param {Object[]} items - Array of raw items.
 * @returns {{ normItems: Object[], merchandiseTotalCents: number }}
 * @throws {ValidationError} If any item is invalid.
 */
function validateItemsArray(items) {
  let merchandiseTotalCents = 0;

  const normItems = items.map((it, idx) => {
    if (!it || typeof it !== "object") {
      throw errors.invalidData(`Order.items[${idx}] must be an object.`);
    }

    const { id, name, quantity, unit_amount } = it;

    const normalizedID = Number(id);
    if (!Number.isInteger(normalizedID)) {
      throw errors.invalidData(
        `Order.items[${idx}].id must be a positive integer.`
      );
    }
    if (typeof name !== "string" || name.trim() === "") {
      throw errors.invalidData(
        `Order.items[${idx}].name must be a non-empty string.`
      );
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw errors.invalidData(
        `Order.items[${idx}].quantity must be a positive integer.`
      );
    }
    if (!Number.isInteger(unit_amount) || unit_amount < 0) {
      throw errors.invalidData(
        `Order.items[${idx}].unit_amount must be a non-negative integer (in cents).`
      );
    }

    merchandiseTotalCents += quantity * unit_amount;

    return { id: normalizedID, name: name.trim(), quantity, unit_amount };
  });

  return { normItems, merchandiseTotalCents };
}

/*───────────────────────────────────────────────*/
/*  METADATA VALIDATION (Unified w/ Stripe)      */
/*───────────────────────────────────────────────*/

/**
 * Validates and normalizes order metadata.
 * Strict mode — requires nested shipping_address and billing_address.
 *
 * @param {Object} meta - Raw metadata input.
 * @returns {Object} Normalized metadata object.
 * @throws {ValidationError} If structure is invalid or missing.
 */
function validateMetadata(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    throw errors.invalidData("Metadata must be a valid object.");
  }

  if (
    !meta.shipping_address ||
    !meta.billing_address ||
    typeof meta.shipping_address !== "object" ||
    typeof meta.billing_address !== "object"
  ) {
    throw errors.invalidData(
      "Metadata must include both 'shipping_address' and 'billing_address' objects."
    );
  }

  // Normalize and validate addresses
  const shipping_address = normalizeAddress(meta.shipping_address);
  const billing_address = normalizeAddress(meta.billing_address);

  const billing_same_as_shipping = !!meta.billing_same_as_shipping;

  // Shipping cost validation
  const shipping_cost_cents = Number(meta.shipping_cost_cents);
  if (!Number.isInteger(shipping_cost_cents) || shipping_cost_cents < 0) {
    throw errors.invalidData(
      "shipping_cost_cents must be a non-negative integer."
    );
  }

  // ✅ Preserve (and lightly normalize) discount if present
  let discount = undefined;
  if (meta.discount && typeof meta.discount === "object") {
    const raw = meta.discount;
    const code =
      typeof raw.code === "string" ? raw.code.trim() : undefined;

    // accept either `value` or `percent`
    const percentSrc =
      raw.value ?? raw.percent ?? raw.discountPercent ?? undefined;
    const percent = Number.isFinite(Number(percentSrc))
      ? Math.max(0, Math.trunc(Number(percentSrc)))
      : undefined;

    const amount_cents =
      Number.isInteger(raw.amount_cents) && raw.amount_cents >= 0
        ? raw.amount_cents
        : undefined;

    discount = {
      ...(code ? { code } : {}),
      ...(percent != null ? { percent } : {}),
      ...(amount_cents != null ? { amount_cents } : {}),
    };
  }

  return {
    billing_same_as_shipping,
    shipping_cost_cents,
    shipping_address,
    billing_address,
    stripe_session_id:
      typeof meta.stripe_session_id === "string" ||
      typeof meta.stripe_session_id === "number"
        ? normalizeId(meta.stripe_session_id)
        : "",
    client_reference_id:
      typeof meta.client_reference_id === "string" ||
      typeof meta.client_reference_id === "number"
        ? normalizeId(meta.client_reference_id)
        : "",
    ...(discount ? { discount } : {}),
  };
}

/*───────────────────────────────────────────────*/
/*  STATUS MANAGEMENT                            */
/*───────────────────────────────────────────────*/

export function updateOrderStatus(
  currentStatus,
  key,
  { status, date = null, time = null }
) {
  assertValidStatusKey(key);
  if (typeof status !== "boolean") {
    throw errors.invalidData("status must be boolean");
  }
  return {
    ...currentStatus,
    [key]: { status, date, time },
  };
}

/*───────────────────────────────────────────────*/
/*  MAIN ORDER VALIDATOR                         */
/*───────────────────────────────────────────────*/

/**
 * Validates and prepares an order payload before writing to the database.
 * Includes shipping cost validation and full metadata checks.
 */
export async function validateAndPrepareOrder(order, options = {}) {
  const { isRequestedOrderForOtherCountries = false, isSample = false } =
    options;

  if (!order || typeof order !== "object" || Array.isArray(order)) {
    return Promise.reject(
      errors.invalidData("You did not Introduce an Object for your new Order")
    );
  }

  const {
    name,
    email,
    phone,
    amount_total,
    currency,
    items,
    metadata,
    payment_status,
  } = order;

  const shippingCents = Number(
    order.shipping_cost_cents ?? order.metadata?.shipping_cost_cents ?? 0
  );

  // --- Basic fields ---
  if (typeof name !== "string" || name.trim() === "") {
    return Promise.reject(
      errors.invalidData("Missing or invalid customer name.")
    );
  }

  if (typeof email !== "string" || email.trim() === "") {
    return Promise.reject(
      errors.invalidData("Missing or invalid customer email.")
    );
  }

  if (typeof phone !== "string" || phone.trim() === "") {
    return Promise.reject(
      errors.invalidData("Missing or invalid customer phone.")
    );
  }

  const emailTrimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    return Promise.reject(errors.invalidData("Invalid email format."));
  }

  // --- Amount and currency ---
  const hasAmountTotal = Object.prototype.hasOwnProperty.call(
    order,
    "amount_total"
  );
  const amountTotalProvided = Number.isInteger(amount_total);
  let amountTotal = amountTotalProvided ? amount_total : 0;

  if (!amountTotalProvided || amountTotal < 0) {
    if (!isSample || hasAmountTotal) {
      return Promise.reject(
        errors.invalidData(
          "amount_total must be a positive integer (in cents)."
        )
      );
    }
  }

  if (shippingCents < 0) {
    return Promise.reject(
      errors.invalidData(
        "shippingCostCents must be a non-negative integer (in cents)."
      )
    );
  }

  if (!isSample && amountTotal < shippingCents) {
    return Promise.reject(
      errors.invalidData(
        "amount_total must be greater than or equal to shippingCostCents."
      )
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    return Promise.reject(
      errors.invalidData("You did not Introduce a valid array for items.")
    );
  }

  if (typeof currency !== "string" || currency.trim() === "") {
    return Promise.reject(errors.invalidData("Missing or invalid currency."));
  }

  const currencyNorm = currency.trim().toLowerCase();
  if (!allowedCurrencies.has(currencyNorm)) {
    return Promise.reject(
      errors.invalidData(`Unsupported currency: ${currencyNorm}`)
    );
  }

  const resolvedPaymentId = order.payment_id;
  console.log("PaymentId :", order.name);
  if (!resolvedPaymentId)
    return Promise.reject(errors.invalidData("No payment ID"));

  const rawPaymentType =
    typeof order.payment_type === "string"
      ? order.payment_type.trim().toUpperCase()
      : "";

  // Detect if order originated from Stripe
  const hasStripeSession =
    Boolean(order.session_id) ||
    Boolean(order.metadata?.stripe_session_id) ||
    (typeof order.payment_type === "string" &&
      order.payment_type.trim().toUpperCase() === PAYMENT_TYPE.STRIPE);

  // Explicit rule: Stripe if it looks like Stripe, otherwise Manual
  const normalizedPaymentType = hasStripeSession
    ? PAYMENT_TYPE.STRIPE
    : PAYMENT_TYPE.MANUAL;

  // Paid automatically if Stripe, otherwise unpaid
  const paymentStatusNormalized = isRequestedOrderForOtherCountries || isSample
    ? false
    : true;

  if (typeof paymentStatusNormalized !== "boolean") {
    return Promise.reject(
      errors.invalidData("Missing or invalid payment status.")
    );
  }

  // --- Validate items & metadata ---
  const { normItems, merchandiseTotalCents } = validateItemsArray(items);
  const normMetadata = validateMetadata(metadata);

  // ───────────────────────────────────────────────────────────────
  // Discount math validation (merchandise-only discount, not shipping)
  // ───────────────────────────────────────────────────────────────
  const disc =
    normMetadata && typeof normMetadata.discount === "object"
      ? normMetadata.discount
      : null;

  // Basic guards
  if (merchandiseTotalCents < 0) {
    return Promise.reject(errors.invalidData("Invalid merchandise total."));
  }
  if (!isSample && shippingCents > amountTotal) {
    return Promise.reject(
      errors.invalidData("amount_total cannot be less than shipping.")
    );
  }

  let expectedDiscountCents = 0;

  if (disc) {
    // Validate types/ranges (code is optional but must be a string if present)
    if (typeof disc.code !== "undefined" && typeof disc.code !== "string") {
      return Promise.reject(
        errors.invalidData("discount.code must be a string when provided.")
      );
    }
    if (typeof disc.percent !== "undefined") {
      const p = Number(disc.percent);
      if (!Number.isFinite(p) || p < 0 || p > 100) {
        return Promise.reject(
          errors.invalidData(
            "discount.percent must be a number between 0 and 100."
          )
        );
      }
    }
    if (typeof disc.amount_cents !== "undefined") {
      const a = Number(disc.amount_cents);
      if (!Number.isInteger(a) || a < 0) {
        return Promise.reject(
          errors.invalidData(
            "discount.amount_cents must be a non-negative integer."
          )
        );
      }
    }

    // Compute discount from percent on merchandise only
    const percent = Number.isFinite(Number(disc?.percent))
      ? Math.trunc(Number(disc.percent))
      : null;

    if (percent && percent > 0 && merchandiseTotalCents > 0) {
      expectedDiscountCents = Math.floor(
        (merchandiseTotalCents * percent) / 100
      );
      // safety cap
      expectedDiscountCents = Math.max(
        0,
        Math.min(expectedDiscountCents, merchandiseTotalCents)
      );
    }

    // If client sent amount_cents, it must match our computed one (±1 cent tolerance)
    if (Number.isInteger(disc?.amount_cents)) {
      const delta = Math.abs(
        Number(disc.amount_cents) - expectedDiscountCents
      );
      if (delta > 1) {
        return Promise.reject(
          errors.invalidData(
            "Discount amount does not match merchandise × percent calculation."
          )
        );
      }
      // trust server-side recompute; normalize to computed
      expectedDiscountCents = Math.min(
        Number(disc.amount_cents),
        merchandiseTotalCents
      );
    }
  }

  // Final math: merchandise + shipping − discount
  const expectedTotal = Math.max(
    0,
    merchandiseTotalCents + shippingCents - expectedDiscountCents
  );

  // Allow ±1 cent tolerance for rounding
  if (isSample) {
    if (amountTotalProvided && Math.abs(amountTotal - expectedTotal) > 1) {
      console.warn(
        `[validateAndPrepareOrder] Sample order amount_total (${amountTotal}) does not match expected total (${expectedTotal}). Using expected total.`
      );
    }
    amountTotal = expectedTotal;
  } else if (Math.abs(amountTotal - expectedTotal) > 1) {
    return Promise.reject(
      errors.invalidData(
        `Order total mismatch. Expected ${expectedTotal} cents, got ${amountTotal} cents.`
      )
    );
  }

  const initialStatus = makeDefaultStatus();
  const initalSentShipEmailStatus = false;
  const rawSessionId =
    typeof order.session_id !== "undefined"
      ? order.session_id
      : normMetadata.stripe_session_id;
  const normalizedSessionId =
    rawSessionId === null
      ? ""
      : normalizeId(
          typeof rawSessionId === "string" || typeof rawSessionId === "number"
            ? rawSessionId
            : ""
        );

  // --- Build final normalized order ---
  const prepared = {
    id: randomUUID(),
    event_id: randomUUID(),
    payment_id: resolvedPaymentId,
    payment_type: normalizedPaymentType,
    name: name.trim(),
    email: emailTrimmed,
    phone: phone,
    currency: currencyNorm,
    items: normItems,
    amount_total: amountTotal,
    shipping_cost_cents: shippingCents,
    session_id: normalizedSessionId || "",
    payment_status: paymentStatusNormalized,
    metadata: {
      ...normMetadata,
    },
    status: initialStatus,
    sentShippingEmail: initalSentShipEmailStatus,
    track_url: "",
    written_at: new Date().toISOString(),
  };

  return prepared;
}

/*───────────────────────────────────────────────*/
/*  MERGING + HELPERS                            */
/*───────────────────────────────────────────────*/

export const isPlainObject = (v) =>
  v && typeof v === "object" && !Array.isArray(v);

export function mergeOrderChanges(existing, changes) {
  const updated = { ...existing };

  for (const [k, v] of Object.entries(changes)) {
    if (!Object.prototype.hasOwnProperty.call(existing, k)) continue;

    if (k === "status" && isPlainObject(v) && isPlainObject(existing.status)) {
      updated.status = { ...existing.status };
      for (const [sk, sv] of Object.entries(v)) {
        const prev = isPlainObject(updated.status[sk])
          ? updated.status[sk]
          : {};
        updated.status[sk] = isPlainObject(sv) ? { ...prev, ...sv } : sv;
      }
      continue;
    }

    if (isPlainObject(v) && isPlainObject(existing[k])) {
      updated[k] = { ...existing[k], ...v };
    } else {
      updated[k] = v;
    }
  }

  return updated;
}
