// api/constants/orderStatus.mjs

/**
 * Canonical shipment / order status definition
 * Shared across backend and frontend for consistency.
 */

export const STATUS_KEYS = [
  "awaiting_ctt",
  "accepted",
  "in_transit",
  "in_delivery",
  "delivered",
];

export const STATUS_LABELS = {
  awaiting_ctt: "Awaiting CTT",
  accepted: "Accepted",
  in_transit: "In Transit",
  in_delivery: "In Delivery",
  delivered: "Delivered",
};

/**
 * Returns a blank normalized status object for a new order.
 */
export function makeDefaultStatus() {
  const template = { status: false, date: null, time: null };
  return Object.fromEntries(STATUS_KEYS.map((k) => [k, { ...template }]));
}

/**
 * Returns a fully validated status key (throws if invalid)
 */
export function assertValidStatusKey(key) {
  if (!STATUS_KEYS.includes(key)) {
    throw new Error(
      `Invalid status key "${key}". Allowed: ${STATUS_KEYS.join(", ")}`
    );
  }
  return key;
}
