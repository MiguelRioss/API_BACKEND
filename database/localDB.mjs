// database/localDB.mjs
import fs from "fs";
import path from "path";
import errors from "../errors/errors.mjs";

const DEFAULT_FILE = path.resolve(process.cwd(), "database", "data.json");
const DB_FILE = process.env.LOCAL_DB_FILE || DEFAULT_FILE;

/**
 * Safely read and parse a JSON file.
 *
 * @param {string} file - Path to the JSON file.
 * @returns {Object} Parsed object or empty object if missing/corrupt.
 */
function readFileSafe(file) {
  try {
    if (!fs.existsSync(file)) return {};
    const txt = fs.readFileSync(file, "utf8");
    return JSON.parse(txt || "{}");
  } catch (err) {
    console.error("[localDB] read error:", err?.message || err);
    return {};
  }
}

/**
 * Ensure parent directory exists for a file path.
 *
 * @param {string} file - File path.
 */
function ensureDirForFile(file) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Atomically write an object to JSON file.
 * Uses temp file + rename to avoid partial writes.
 *
 * @param {string} file - File path.
 * @param {Object} obj - Data to persist.
 * @returns {void}
 * @throws {ApplicationError} If write fails.
 */
function writeFileAtomic(file, obj) {
  try {
    ensureDirForFile(file);
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), { encoding: "utf8" });
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error("[localDB] write error:", err?.message ?? err);
    throw errors.EXTERNAL_SERVICE_ERROR("Failed to write database file", {
      original: err?.message ?? String(err),
    });
  }
}

/**
 * Get all orders, sorted by `written_at` descending.
 *
 * @async
 * @returns {Promise<Object[]>} Array of orders (possibly empty).
 */
export async function getAllOrders() {
  const map = readFileSafe(DB_FILE);
  const arr = Object.values(map || {});
  arr.sort((a, b) => {
    if (!a?.written_at && !b?.written_at) return 0;
    if (!a?.written_at) return 1;
    if (!b?.written_at) return -1;
    return a.written_at > b.written_at ? -1 : a.written_at < b.written_at ? 1 : 0;
  });
  return arr;
}

/**
 * Get a single order by ID.
 *
 * @async
 * @param {string|number} id - Order identifier.
 * @returns {Promise<Object>} The found order.
 * @rejects {ApplicationError} NOT_FOUND if missing.
 */
export async function getOrderById(id) {
  const map = readFileSafe(DB_FILE) || {};
  const bucket = map.orders ?? map;
  const key = String(id);

  const order = bucket[key];
  if (order == null) {
    return Promise.reject(errors.NOT_FOUND(`Order with ID: ${key} not found`));
  }
  return order;
}

/**
 * Create a new order.
 *
 * @async
 * @param {Object} orderObject - Validated order object.
 * @returns {Promise<Object>} Stored order object.
 * @rejects {ApplicationError} INVALID_DATA if input is not an object.
 */
export async function createOrderDB(orderObject) {
  if (typeof orderObject !== "object" || orderObject === null) {
    return Promise.reject(errors.INVALID_DATA("createOrderDB expects a valid order object"));
  }
  const map = readFileSafe(DB_FILE);
  map[orderObject.id] = orderObject;
  writeFileAtomic(DB_FILE, map);
  return orderObject;
}

const isPlainObject = (v) => v && typeof v === "object" && !Array.isArray(v);

/**
 * Update an order by replacing with a new version.
 *
 * @async
 * @param {string|number} id - Order ID.
 * @param {Object} updatedOrder - Validated, merged order object.
 * @returns {Promise<Object>} The updated order with id.
 * @rejects {ApplicationError} NOT_FOUND if the order doesn’t exist.
 */
export async function updateOrderDB(id, updatedOrder) {
  const map = readFileSafe(DB_FILE) || {};
  const bucket = isPlainObject(map.orders) ? map.orders : map;
  const key = String(id);

  if (!bucket[key]) {
    return Promise.reject(errors.NOT_FOUND(`Order with ID: ${key} not found`));
  }

  bucket[key] = updatedOrder;
  if (bucket !== map) map.orders = bucket;
  writeFileAtomic(DB_FILE, map);

  return { id: key, ...updatedOrder };
}

/**
 * Get the raw database map (for debugging).
 *
 * @async
 * @returns {Promise<Object>} Raw map of all stored data.
 */
export async function getRawMap() {
  return readFileSafe(DB_FILE);
}
