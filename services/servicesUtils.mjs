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

/**
 * Validates and normalizes an id.
 *
 * @async
 * @param {string|number} id - The id to validate.
 * @returns {Promise<string>} Resolves with the normalized, trimmed id string.
 * @rejects {ValidationError} If the id is null, undefined, or empty.
 */
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

/**
 * Converts an id into a trimmed string.
 *
 * @param {string|number} id - The raw id.
 * @returns {string} Normalized id string.
 */
export function normalizeId(id) {
  return String(id).trim();
}

/**
 * Compares a candidate value against a needle.
 * Matches by strict string equality or numeric equality (e.g. `"2"` equals `2`).
 *
 * @param {*} candidate - Value to test (string, number, etc.).
 * @param {*} needle - Value to match against.
 * @returns {boolean} True if candidate matches the needle, false otherwise.
 */
export function candidateMatches(candidate, needle) {
  if (candidate === null || typeof candidate === "undefined") return false;
  const c = String(candidate);
  const n = String(needle);

  if (c === n) return true;

  const cNum = Number(c);
  const nNum = Number(n);
  return !Number.isNaN(cNum) && !Number.isNaN(nNum) && cNum === nNum;
}

/**
 * Checks whether an order object matches a given id.
 * Tests multiple candidate fields (event_id, id, session_id, metadata fields).
 *
 * @param {Object} order - The order object.
 * @param {string|number} needle - The id to match.
 * @returns {boolean} True if any candidate field matches.
 */
export function orderMatchesId(order, needle) {
  if (!order || !needle) return false;
  const candidates = [
    order.event_id,
    order.id,
    order.session_id,
    order.metadata?.order_id,
    order.metadata?.tracking_id,
  ];

  for (const c of candidates) {
    if (candidateMatches(c, needle)) return true;
  }
  return false;
}

/**
 * Finds an order in an array by flexible id matching.
 *
 * @param {Object[]} ordersArray - Array of order objects.
 * @param {string|number} id - The id to search for.
 * @returns {Object|null} The matched order, or null if none found.
 */
export function findOrderById(ordersArray, id) {
  const needle = normalizeId(id);

  if (!Array.isArray(ordersArray) || ordersArray.length === 0) return null;

  for (const o of ordersArray) {
    if (orderMatchesId(o, needle)) return o;
  }
  return null;
}

/**
 * Filters orders by a boolean status flag.
 *
 * @param {Object[]} orders - Array of orders.
 * @param {boolean|string} [status] - Desired status (boolean or `"true"/"false"` string).
 * @returns {Object[]} Filtered array of orders.
 */
export function filterByStatus(orders = [], status) {
  if (typeof status === "undefined") return orders;
  const want =
    typeof status === "boolean" ? status : String(status).toLowerCase() === "true";
  return orders.filter((o) => Boolean(o.status) === want);
}

/**
 * Filters orders by a search query across common fields.
 *
 * @param {Object[]} orders - Array of orders.
 * @param {string} q - Search string.
 * @returns {Object[]} Filtered array of orders.
 */
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

/**
 * Sorts orders by `written_at` timestamp descending (newest first).
 *
 * @param {Object[]} orders - Array of orders.
 * @returns {Object[]} Sorted array.
 */
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

/**
 * Applies a numeric limit to an orders array.
 *
 * @param {Object[]} orders - Array of orders.
 * @param {number} limit - Maximum number of orders to return.
 * @returns {Object[]} Limited array.
 */
export function applyLimit(orders = [], limit) {
  if (!limit || !Number.isFinite(Number(limit))) return orders;
  return orders.slice(0, Number(limit));
}

/**
 * Validates and normalizes an order payload.
 *
 * @async
 * @param {Object} order - Raw order object supplied by caller.
 * @param {string} order.name - Customer name.
 * @param {string} order.email - Customer email.
 * @param {number} order.amount_total - Declared total in cents.
 * @param {string} order.currency - Currency code (must be allowed).
 * @param {Object[]} order.items - Array of order items { id:number, name:string, quantity:int, unit_amount:int }.
 * @param {Object} [order.metadata] - Optional metadata object.
 * @returns {Promise<Object>} Normalized and enriched order object.
 * @rejects {ValidationError} If invalid.
 */
export async function validateAndPrepareOrder(order) {
  if (!order || typeof order !== "object" || Array.isArray(order)) {
    return Promise.reject(
      errors.invalidData("You did not Introduce an Object for your new Order")
    );
  }

  const { name, email, amount_total, currency, items } = order;

  if (typeof name !== "string" || name.trim() === "") {
    return Promise.reject(
      errors.invalidData("You did not Introduce a valid name for your new Order")
    );
  }

  if (typeof email !== "string" || email.trim() === "") {
    return Promise.reject(
      errors.invalidData("You did not Introduce a valid email for your new Order")
    );
  }
  const emailTrimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    return Promise.reject(
      errors.invalidData("You did not Introduce a valid email for your new Order")
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    return Promise.reject(
      errors.invalidData("You did not Introduce a valid array for items in your new Order")
    );
  }

  if (!Number.isInteger(amount_total) || amount_total < 0) {
    return Promise.reject(
      errors.invalidData("You did not Introduce a valid amount_total in your new Order")
    );
  }

  if (typeof currency !== "string" || currency.trim() === "") {
    return Promise.reject(
      errors.invalidData("You did not Introduce a valid currency in your new Order")
    );
  }
  const currencyNorm = currency.trim().toLowerCase();
  if (!allowedCurrencies.has(currencyNorm)) {
    return Promise.reject(
      errors.invalidData("You did not Introduce a valid accepted currency in your new Order")
    );
  }

  const normItems = validateItemsArray(items, amount_total);
  const normMetadata = validateMetadata(order.metadata);
  const initialStatus = makeDefaultStatus();

  const prepared = {
    ...order,
    id: randomUUID(),
    name: name.trim(),
    email: emailTrimmed,
    currency: currencyNorm,
    items: normItems,
    amount_total,
    metadata: normMetadata,
    status: initialStatus,
    track_url: "",
    event_id: randomUUID(),
    written_at: new Date().toISOString(),
  };
  return prepared;
}

/**
 * Updates the order status with validation.
 *
 * @param {Object} currentStatus - Current status object.
 * @param {string} key - Status key to update (must be one of STATUS_KEYS).
 * @param {Object} update - Status update.
 * @param {boolean} update.status - True/false flag.
 * @param {string|null} [update.date] - Date string.
 * @param {string|null} [update.time] - Time string.
 * @returns {Object} Updated status object.
 * @throws {ValidationError} If the key or update is invalid.
 */
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

/**
 * Creates a default status object for an order.
 *
 * @returns {Object} Status object with all keys set to {status:false,date:null,time:null}.
 */
function makeDefaultStatus() {
  const template = { status: false, date: null, time: null };
  return Object.fromEntries(STATUS_KEYS.map((k) => [k, { ...template }]));
}

/**
 * Validates and normalizes optional order metadata.
 *
 * @param {Object|undefined} metadata - Raw metadata input.
 * @returns {Object} Normalized metadata object (never null).
 * @throws {ValidationError} If metadata is not a plain object.
 */
function validateMetadata(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  const clean = {};

  for (const [key, val] of Object.entries(meta)) {
    // Keep objects intact
    if (val && typeof val === "object") {
      clean[key] = val;
    } else if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      clean[key] = val;
    } else {
      // ignore null/undefined
      clean[key] = "";
    }
  }

  return clean;
}

/**
 * Validates and normalizes an array of order items.
 *
 * @param {Object[]} items - Array of raw items.
 * @param {number} amount_total - Declared total (in cents).
 * @returns {Object[]} Normalized items.
 * @throws {ValidationError} If any item is invalid or totals mismatch.
 */
function validateItemsArray(items, amount_total) {
  let computedTotal = 0;
  const normItems = items.map((it, idx) => {
    if (!it || typeof it !== "object") {
      throw errors.invalidData(`Order.items[${idx}] must be an object.`);
    }

    const { id, name, quantity, unit_amount } = it;

    // id is an integer (stock/product id)
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
        `Order.items[${idx}].unit_amount must be a non-negative integer (e.g., cents).`
      );
    }

    computedTotal += quantity * unit_amount;

    return {
      id: String(id),
      name: String(name).trim(),
      quantity,
      unit_amount,
    };
  });

  if (computedTotal !== amount_total) {
    throw errors.invalidData(
      `Order.amount_total (${amount_total}) does not match items total (${computedTotal}).`
    );
  }

  return normItems;
}

/**
 * Checks if a value is a "plain object".
 *
 * @param {*} v - Any value.
 * @returns {boolean} True if v is a non-null object and not an array.
 */
export const isPlainObject = (v) =>
  v && typeof v === "object" && !Array.isArray(v);


/**
 * Merge changes into an existing order object.
 *
 * - Ignores unknown keys.
 * - Special merge strategy for `status`: merges nested status objects per subkey.
 * - Shallow merge for plain objects (e.g., metadata).
 * - Replace for primitives and arrays.
 *
 * @param {Object} existing - The existing order object.
 * @param {Object} changes - Partial order object with changes.
 * @returns {Object} A new updated order object.
 */
export function mergeOrderChanges(existing, changes) {
  const updated = { ...existing };

  for (const [k, v] of Object.entries(changes)) {
    if (!Object.prototype.hasOwnProperty.call(existing, k)) continue;

    // Special case: status field
    if (k === "status" && isPlainObject(v) && isPlainObject(existing.status)) {
      updated.status = { ...existing.status };
      for (const [sk, sv] of Object.entries(v)) {
        const prev = isPlainObject(updated.status[sk]) ? updated.status[sk] : {};
        updated.status[sk] = isPlainObject(sv) ? { ...prev, ...sv } : sv;
      }
      continue;
    }

    // Generic shallow merge for objects
    if (isPlainObject(v) && isPlainObject(existing[k])) {
      updated[k] = { ...existing[k], ...v };
    } else {
      updated[k] = v;
    }
  }

  return updated;
}
