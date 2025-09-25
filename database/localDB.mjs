// database/localDB.mjs
import fs, { writeFile } from 'fs';
import path from 'path';

const DEFAULT_FILE = path.resolve(process.cwd(), 'database', 'data.json');
const DB_FILE = process.env.LOCAL_DB_FILE || DEFAULT_FILE;

function readFileSafe(file) {
  try {
    if (!fs.existsSync(file)) return {};
    const txt = fs.readFileSync(file, 'utf8');
    return JSON.parse(txt || '{}');
  } catch (err) {
    console.error('[localDB] read error:', err?.message || err);
    return {};
  }
}


/** Ensure parent directory exists for file path */
function ensureDirForFile(file) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Atomic write: write to tmp file then rename */
function writeFileAtomic(file, obj) {
  try {
    ensureDirForFile(file);
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), { encoding: "utf8" });
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error("[localDB] write error:", err?.message ?? err);
    throw err;
  }
}

/**
 * Returns Promise<Array> sorted by written_at desc if present
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
 * Returns Promise<Object|null>
 */
export async function getOrderById(id) {
  const map = readFileSafe(DB_FILE);
  return map?.[id] ?? null;
}

// database/localDB.mjs (excerpt)
export async function createOrderDB(orderObject) {
  if (typeof orderObject !== "object" || orderObject === null) {
    throw new TypeError("createOrderDB expects an object as orderObject");
  }
  const map = readFileSafe(DB_FILE);
  map[orderObject.id] = orderObject;
  writeFileAtomic(DB_FILE, map);
  // Return the exact object stored (no mutation)
  return orderObject;
}

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
/**
 * Update an order by id, changing only keys that ALREADY exist on the order.
 * Nested objects are merged shallowly (one level).
 *
 * @param {string|number} id
 * @param {object} orderChanges - validated keys (already checked by services)
 * @returns {Promise<object>} updated order (including id)
 */
export async function updateOrderDB(id, orderChanges = {}) {
  const map = readFileSafe(DB_FILE) || {};
  const bucket = isPlainObject(map.orders) ? map.orders : map;
  const key = String(id);
  const existing = bucket[key];
  if (!existing) throw new Error(`Order "${key}" not found`);

  // 1) Unwrap { changes: {...} } if present
  const changes = (orderChanges && orderChanges.changes && isPlainObject(orderChanges.changes))
    ? orderChanges.changes
    : orderChanges;

  // 2) Merge only existing keys; handle status specially
  const updated = { ...existing };

  for (const [k, v] of Object.entries(changes)) {
    if (!Object.prototype.hasOwnProperty.call(existing, k)) {
      // ignore unknown top-level keys
      continue;
    }

    // Special case: status (shallow merge fields like {status,date,time} per subkey)
    if (k === "status" && isPlainObject(v) && isPlainObject(existing.status)) {
      updated.status = { ...existing.status };
      for (const [sk, sv] of Object.entries(v)) {
        const prev = isPlainObject(updated.status[sk]) ? updated.status[sk] : {};
        updated.status[sk] = isPlainObject(sv) ? { ...prev, ...sv } : sv;
      }
      continue;
    }

    // Generic shallow merge for objects; replace for primitives/arrays
    if (isPlainObject(v) && isPlainObject(existing[k])) {
      updated[k] = { ...existing[k], ...v };
    } else {
      updated[k] = v;
    }
  }

  updated.updatedAt = new Date().toISOString();
  bucket[key] = updated;

  if (bucket !== map) map.orders = bucket;

  // 3) Await the write so it actually persists before returning
   writeFileAtomic(DB_FILE, map);

  return { id: key, ...updated };
}


// Optional export: helper to read raw map
export async function getRawMap() {
  return readFileSafe(DB_FILE);
}
