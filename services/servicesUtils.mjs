// api/services/servicesUtils.mjs
import { ValidationError } from "../errors/domainErros.mjs";
import { randomUUID } from "node:crypto";


/**
 * Utility validators and matching helpers used by services.
 * Pure functions, no DB access here.
 *
 * Exported:
 *  - validateIdOrThrow(id)
 *  - normalizeId(id)
 *  - candidateMatches(candidate, needle)   (internal, exported for tests if desired)
 *  - orderMatchesId(order, needle)
 *  - findOrderById(ordersArray, id)
 */

/** Throw ValidationError if id is empty-ish */
export function validateIdOrThrow(id) {
  if (id === null || typeof id === "undefined") {
    throw new ValidationError("Order id is required");
  }
  const s = String(id).trim();
  if (s === "") {
    throw new ValidationError("Order id is required");
  }
  return s;
}

/** Normalize id to trimmed string */
export function normalizeId(id) {
  return String(id).trim();
}

/** Return true if candidate matches needle by either strict string equality or numeric equality */
export function candidateMatches(candidate, needle) {
  if (candidate === null || typeof candidate === "undefined") return false;
  const c = String(candidate);
  const n = String(needle);

  if (c === n) return true;

  // numeric tolerant comparison (e.g. '2' === 2)
  const cNum = Number(c);
  const nNum = Number(n);
  if (!Number.isNaN(cNum) && !Number.isNaN(nNum) && cNum === nNum) return true;

  return false;
}

/** Given an order object and needle string, test a set of candidate fields */
export function orderMatchesId(order, needle) {
  if (!order || !needle) return false;
  const candidates = [
    order.event_id,
    order.id,
    order.session_id,
    order.metadata?.order_id,
    order.metadata?.tracking_id,
    // you can add other candidate fields here if your data includes them
  ];

  for (const c of candidates) {
    if (candidateMatches(c, needle)) return true;
  }
  return false;
}

/**
 * Find order in array by flexible id matching.
 * Returns the found order or null.
 */
export function findOrderById(ordersArray, id) {
  const needle = normalizeId(id);

  if (!Array.isArray(ordersArray) || ordersArray.length === 0) return null;

  for (const o of ordersArray) {
    if (orderMatchesId(o, needle)) return o;
  }
  return null;
}


// api/services/servicesUtils.mjs
/**
 * Pure helpers for filtering, searching, sorting and paging order arrays.
 * These are side-effect free and easy to unit-test.
 */

export function filterByStatus(orders = [], status) {
  if (typeof status === "undefined") return orders;
  const want = typeof status === "boolean" ? status : String(status).toLowerCase() === "true";
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
      o?.metadata?.addr_line1,
      o?.metadata?.addr_zip,
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


// servicesUtils.mjs

/**
 * Validates and normalizes an order payload.
 * - Ensures required fields exist and have the right types
 * - Validates each item (id, name, quantity, unit_amount)
 * - Checks that amount_total === sum(items.quantity * unit_amount)
 * - Normalizes strings (trim, lower-casing currency/email)
 * - Injects event_id, written_at, default status, metadata / metadata_raw
 */
export function validateAndPrepareOrder(order) {
  if (!order || typeof order !== "object" || Array.isArray(order)) {
    throw new ValidationError("Order object is required.");
  }

  // ——— Basic required fields ———
  const { name, email, amount_total, currency, items, metadata } = order;

  if (typeof name !== "string" || name.trim() === "") {
    throw new ValidationError("Order.name is required and must be a non-empty string.");
  }

  if (typeof email !== "string" || email.trim() === "") {
    throw new ValidationError("Order.email is required and must be a non-empty string.");
  }
  const emailTrimmed = email.trim().toLowerCase();
  // light email sanity check (not overzealous)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    throw new ValidationError("Order.email must be a valid email address.");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError("Order.items is required and must be a non-empty array.");
  }

  if (!Number.isInteger(amount_total) || amount_total < 0) {
    throw new ValidationError("Order.amount_total must be a non-negative integer (e.g., cents).");
  }

  if (typeof currency !== "string" || currency.trim() === "") {
    throw new ValidationError("Order.currency is required and must be a non-empty string.");
  }
  const currencyNorm = currency.trim().toLowerCase();
  // optional: restrict to a known set if your system only supports a few
  const allowedCurrencies = new Set(["eur", "usd", "gbp"]);
  if (!allowedCurrencies.has(currencyNorm)) {
    throw new ValidationError(`Unsupported currency: ${currencyNorm}`);
  }

  // ——— Validate items ———
  let computedTotal = 0;
  const normItems = items.map((it, idx) => {
    if (!it || typeof it !== "object") {
      throw new ValidationError(`Order.items[${idx}] must be an object.`);
    }
    const { id, name, quantity, unit_amount } = it;

    if (typeof id !== "string" || id.trim() === "") {
      throw new ValidationError(`Order.items[${idx}].id must be a non-empty string.`);
    }
    if (typeof name !== "string" || name.trim() === "") {
      throw new ValidationError(`Order.items[${idx}].name must be a non-empty string.`);
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError(`Order.items[${idx}].quantity must be a positive integer.`);
    }
    if (!Number.isInteger(unit_amount) || unit_amount < 0) {
      throw new ValidationError(`Order.items[${idx}].unit_amount must be a non-negative integer (e.g., cents).`);
    }

    computedTotal += quantity * unit_amount;

    return {
      id: String(id).trim(),
      name: String(name).trim(),
      quantity,
      unit_amount,
    };
  });

  if (computedTotal !== amount_total) {
    throw new ValidationError(
      `Order.amount_total (${amount_total}) does not match items total (${computedTotal}).`
    );
  }

  // ——— Validate metadata (optional but typed) ———
  let normMetadata = {};
  if (typeof metadata !== "undefined") {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      throw new ValidationError("Order.metadata, if provided, must be an object.");
    }
    const coerceStr = v => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));
    normMetadata = {
      addr_city: coerceStr(metadata.addr_city ?? ""),
      addr_ctry: coerceStr(metadata.addr_ctry ?? ""),
      addr_line1: coerceStr(metadata.addr_line1 ?? ""),
      addr_zip: coerceStr(metadata.addr_zip ?? ""),
      full_name: coerceStr(metadata.full_name ?? ""),
      phone: coerceStr(metadata.phone ?? ""),
      // keep any extra keys but as strings where sensible
      ...Object.fromEntries(
        Object.entries(metadata).filter(([k]) =>
          !["addr_city", "addr_ctry", "addr_line1", "addr_zip", "full_name", "phone"].includes(k)
        )
      ),
    };
  }


  function makeDefaultStatus() {
    return {
      delivered: { status: false, date: null, time: null },
      acceptedInCtt: { status: false, date: null, time: null },
      accepted: { status: false, date: null, time: null },
      in_transit: { status: false, date: null, time: null }, // ← canonical
      wating_to_Be_Delivered: { status: false, date: null, time: null },
    };
  }
  // ——— Build prepared (normalized) object ———
  const prepared = {
    ...order,
    name: name.trim(),
    email: emailTrimmed,
    currency: currencyNorm,
    items: normItems,
    amount_total, // already validated
    metadata: normMetadata,

    // IMPORTANT: on creation, enforce all-false status regardless of input
    status: makeDefaultStatus(),
  };

  // Inject event_id if missing/empty
  if (typeof prepared.event_id !== "string" || prepared.event_id.trim() === "") {
    prepared.event_id = randomUUID();
  }

  // Inject written_at if missing
  if (!prepared.written_at) prepared.written_at = new Date().toISOString();

  // Normalize / default status
  if (typeof prepared.status === "undefined") prepared.status = false;

  // Ensure metadata_raw exists (optional: snapshot raw input)
  if (typeof prepared.metadata_raw === "undefined") prepared.metadata_raw = { ...order.metadata };
  
  if (!prepared.id) prepared.id = randomUUID();
  
  if (!prepared.track_url) prepared.track_url = ""
  return prepared;
}


//Update orderStatus
export function updateOrderStatus(currentStatus, key, { status, date = null, time = null }) {
  if (!STATUS_KEYS.includes(key)) {
    throw new ValidationError(`Unknown status step "${key}". Allowed: ${STATUS_KEYS.join(", ")}`);
  }
  if (typeof status !== "boolean") {
    throw new ValidationError("status must be boolean");
  }
  return {
    ...currentStatus,
    [key]: { status, date, time },
  };
}
