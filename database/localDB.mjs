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
export async function createOrderDB(orderObject, key) {
  if (typeof orderObject !== "object" || orderObject === null) {
    throw new TypeError("createOrderDB expects an object as orderObject");
  }

  // REQUIRE key to be provided explicitly or via orderObject.event_id
  let storageKey = undefined;
  if (typeof key === "string" && key.trim() !== "") {
    storageKey = key.trim();
  } else if (typeof orderObject.event_id === "string" && orderObject.event_id.trim() !== "") {
    storageKey = orderObject.event_id.trim();
  } else {
    // Force caller (service) to provide an id — do not invent one silently
    throw new Error("createOrderDB requires a storage key. Services must provide an event_id.");
  }

  const map = readFileSafe(DB_FILE);
  map[storageKey] = orderObject;
  writeFileAtomic(DB_FILE, map);

  // Return the exact object stored (no mutation)
  return orderObject;
}



// Optional export: helper to read raw map
export async function getRawMap() {
  return readFileSafe(DB_FILE);
}
