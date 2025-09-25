// --- helpers (top of file or a small utils module) ---
export const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

export const STATUS_ALIASES = {
  accepted_in_ctt: "acceptedInCtt",
  acceptedinctt: "acceptedInCtt",
  inTraffic: "in_transit",
  in_traffic: "in_transit",
  waiting_to_be_delivered: "wating_to_Be_Delivered",
};

export const STATUS_KEYS = new Set([
  "delivered",
  "acceptedInCtt",
  "accepted",
  "in_transit",
  "wating_to_Be_Delivered",
]);

export function canonStatusKey(k) {
  const key = String(k);
  const alias = STATUS_ALIASES[key] || STATUS_ALIASES[key.toLowerCase()];
  return alias || key;
}
