// api/services/servicesUtils.mjs
import { randomUUID } from "node:crypto";
import errors from "../errors/errors.mjs";

const allowedCurrencies = new Set(["eur", "usd", "gbp"]);
const STATUS_KEYS = [
  "delivered",
  "acceptedInCtt",
  "accepted",
  "in_transit",
  "waitingToBeDelivered",
];

/*───────────────────────────────────────────────*/
/*  BASIC UTILITIES                              */
/*───────────────────────────────────────────────*/

export async function validateAndNormalizeID(id) {
  if (id === null || typeof id === "undefined") {
    return Promise.reject(
      errors.invalidData(`To create an Order you must provide a valid id, not ${id}`)
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

export function filterByStatus(orders = [], status) {
  if (typeof status === "undefined") return orders;
  const want =
    typeof status === "boolean" ? status : String(status).toLowerCase() === "true";
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
    return fields.some((f) => (f ? String(f).toLowerCase().includes(needle) : false));
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
    line1: (addr.line1 ?? "").trim(),
    city: (addr.city ?? "").trim(),
    postal_code: (addr.postal_code ?? "").trim(),
    country: (addr.country ?? "").trim().toUpperCase(),
  };
}

/**
 * Validates and normalizes an array of order items.
 * Includes verification that item totals + shipping cost = amount_total.
 *
 * @param {Object[]} items - Array of raw items.
 * @param {number} amount_total - Declared total (in cents).
 * @param {number} shippingCents - Shipping cost in cents.
 * @returns {Object[]} Normalized items.
 * @throws {ValidationError} If any item is invalid or totals mismatch.
 */
function validateItemsArray(items, amount_total, shippingCents = 0) {
  let computedTotal = 0;

  const normItems = items.map((it, idx) => {
    if (!it || typeof it !== "object") {
      throw errors.invalidData(`Order.items[${idx}] must be an object.`);
    }

    const { id, name, quantity, unit_amount } = it;

    if (!Number.isInteger(id) || id < 0) {
      throw errors.invalidData(`Order.items[${idx}].id must be a positive integer.`);
    }
    if (typeof name !== "string" || name.trim() === "") {
      throw errors.invalidData(`Order.items[${idx}].name must be a non-empty string.`);
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw errors.invalidData(`Order.items[${idx}].quantity must be a positive integer.`);
    }
    if (!Number.isInteger(unit_amount) || unit_amount < 0) {
      throw errors.invalidData(
        `Order.items[${idx}].unit_amount must be a non-negative integer (in cents).`
      );
    }

    computedTotal += quantity * unit_amount;

    return { id, name: name.trim(), quantity, unit_amount };
  });

  const expectedTotal = computedTotal + shippingCents;

  if (expectedTotal !== amount_total) {
    throw errors.invalidData(
      `Order.amount_total (${amount_total}) does not match items total + shipping (${shippingCents}).`
    );
  }

  return normItems;
}


/*───────────────────────────────────────────────*/
/*  METADATA VALIDATION (Unified w/ Stripe)      */
/*───────────────────────────────────────────────*/

/**
 * Validates and normalizes order metadata.
 * Strict mode — will REJECT legacy flat metadata (addr_city, addr_line1, etc.)
 * Only accepts objects containing nested shipping_address and billing_address.
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

  // Reject legacy flat keys
  const legacyKeys = Object.keys(meta).filter((k) => k.startsWith("addr_"));
  if (legacyKeys.length > 0) {
    throw errors.invalidData(
      `Legacy metadata keys are not allowed: ${legacyKeys.join(", ")}`
    );
  }

  // Normalize and validate addresses
  const shipping_address = normalizeAddress(meta.shipping_address);
  const billing_address = normalizeAddress(meta.billing_address);

  // Validate core metadata fields (strict)
  if (
    typeof meta.full_name !== "string" ||
    meta.full_name.trim().length === 0
  ) {
    throw errors.invalidData("Metadata must include a non-empty 'full_name'.");
  }

  if (typeof meta.email !== "string" || meta.email.trim().length === 0) {
    throw errors.invalidData("Metadata must include a non-empty 'email'.");
  }
  const email = meta.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw errors.invalidData("Metadata.email must be a valid email address.");
  }

  if (typeof meta.phone !== "string" || meta.phone.trim().length === 0) {
    throw errors.invalidData("Metadata must include a non-empty 'phone' number.");
  }

  const full_name = meta.full_name.trim();
  const phone = meta.phone.trim();
  const notes = typeof meta.notes === "string" ? meta.notes.trim() : "";
  const billing_same_as_shipping = !!meta.billing_same_as_shipping;

  // Shipping cost validation
  const shipping_cost_cents = Number(meta.shipping_cost_cents);
  if (!Number.isInteger(shipping_cost_cents) || shipping_cost_cents < 0) {
    throw errors.invalidData("shipping_cost_cents must be a non-negative integer.");
  }

  return {
    full_name,
    email,
    phone,
    notes,
    billing_same_as_shipping,
    shipping_cost_cents,
    shipping_address,
    billing_address,
    stripe_session_id: meta.stripe_session_id ?? "",
    client_reference_id: meta.client_reference_id ?? "",
    payment_status: meta.payment_status ?? "",
  };
}



/*───────────────────────────────────────────────*/
/*  STATUS MANAGEMENT                            */
/*───────────────────────────────────────────────*/

function makeDefaultStatus() {
  const template = { status: false, date: null, time: null };
  return Object.fromEntries(STATUS_KEYS.map((k) => [k, { ...template }]));
}

export function updateOrderStatus(currentStatus, key, { status, date = null, time = null }) {
  if (!STATUS_KEYS.includes(key)) {
    throw errors.invalidData(
      `Unknown status step "${key}". Allowed: ${STATUS_KEYS.join(", ")}`
    );
  }
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
export async function validateAndPrepareOrder(order) {

  if (!order || typeof order !== "object" || Array.isArray(order)) {
    return Promise.reject(
      errors.invalidData("You did not Introduce an Object for your new Order")
    );
  }

  const { name, email, amount_total, currency, items, metadata } = order;
  const shippingCents =
    Number(order.shipping_cost_cents ??
      order.metadata?.shipping_cost_cents ??
      0);
  console.log("Order received for validation:", order);
  // --- Basic fields ---
  if (typeof name !== "string" || name.trim() === "") {
    return Promise.reject(errors.invalidData("Missing or invalid customer name."));
  }

  if (typeof email !== "string" || email.trim() === "") {
    return Promise.reject(errors.invalidData("Missing or invalid customer email."));
  }

  const emailTrimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    return Promise.reject(errors.invalidData("Invalid email format."));
  }

  // --- Amount and currency ---
  if (!Number.isInteger(amount_total) || amount_total < 0) {
    return Promise.reject(errors.invalidData("amount_total must be a positive integer (in cents)."));
  }

  if (shippingCents < 0) {
    return Promise.reject(errors.invalidData("shippingCostCents must be a non-negative integer (in cents)."));
  }

  if (amount_total < shippingCents) {
    return Promise.reject(
      errors.invalidData("amount_total must be greater than or equal to shippingCostCents.")
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    return Promise.reject(errors.invalidData("You did not Introduce a valid array for items."));
  }

  if (typeof currency !== "string" || currency.trim() === "") {
    return Promise.reject(errors.invalidData("Missing or invalid currency."));
  }

  const currencyNorm = currency.trim().toLowerCase();
  if (!allowedCurrencies.has(currencyNorm)) {
    return Promise.reject(errors.invalidData(`Unsupported currency: ${currencyNorm}`));
  }

  // --- Validate items & metadata ---
  const normItems = validateItemsArray(items, amount_total, shippingCents);
  const normMetadata = validateMetadata(metadata);
  const initialStatus = makeDefaultStatus();

  // --- Build final normalized order ---
  const prepared = {
    id: randomUUID(),
    event_id: randomUUID(),
    name: name.trim(),
    email: emailTrimmed,
    currency: currencyNorm,
    items: normItems,
    amount_total,
    shipping_cost_cents: shippingCents,
    metadata: {
      ...normMetadata,
      shipping_cost_cents: shippingCents,
    },
    status: initialStatus,
    fulfilled: false,
    email_sent: false,
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
        const prev = isPlainObject(updated.status[sk]) ? updated.status[sk] : {};
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
