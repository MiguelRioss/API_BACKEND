// api/services/servicesUtils.mjs
import { ValidationError } from "../errors/domainErros.mjs";

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


export function validateAndPrepareOrder(order) {
  if (!order || typeof order !== "object") {
    throw new ValidationError("Order object is required");
  }

  const name = order.name;
  const items = order.items;
  const amount_total = order.amount_total;
  const currency = order.currency;

  if (!name || typeof name !== "string") {
    throw new ValidationError("Order.name is required and must be a string");
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError("Order.items is required and must be a non-empty array");
  }
  if (typeof amount_total !== "number" || Number.isNaN(amount_total)) {
    throw new ValidationError("Order.amount_total is required and must be a number");
  }
  if (!currency || typeof currency !== "string") {
    throw new ValidationError("Order.currency is required and must be a string");
  }

  // Shallow clone to avoid mutating caller object
  const prepared = { ...order };

  // Inject event_id if missing (service responsibility to provide a stable id)
  if (!prepared.event_id || typeof prepared.event_id !== "string" || prepared.event_id.trim() === "") {
    prepared.event_id = crypto.randomUUID();
  }

  // Inject written_at if missing
  if (!prepared.written_at) prepared.written_at = new Date().toISOString();

  // Ensure status injected and default to false
  if (typeof prepared.status === "undefined") prepared.status = false;

  // Ensure metadata and metadata_raw exist (optional but convenient)
  if (typeof prepared.metadata === "undefined") prepared.metadata = {};
  if (typeof prepared.metadata_raw === "undefined") prepared.metadata_raw = {};

  return prepared;
}