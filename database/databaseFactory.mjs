// database/databaseFactory.mjs
const DEFAULT = "local";

/**
 * Return an adapter module namespace (the module itself must export
 * getAllOrders/getOrderById).
 */
export async function getDbAdapter(type = process.env.DB_TYPE || DEFAULT) {
  type = (type || "").toString().toLowerCase();

  switch (type) {
    case "local":
    case "file":
      return await import("./localDB.mjs");

    case "memory":
      return await import("./memoryDB.mjs");

    case "firebase":
      return await import("./firebaseDB.mjs");

    default:
      throw new Error(`Unknown DB adapter type: ${type}`);
  }
}

/**
 * Convenience that returns the module namespace to inject into services.
 * Example:
 *   const db = await createDb({ type: 'local' });
 */
export async function createDb({ type = undefined } = {}) {
  // getDbAdapter already returns the module namespace
  const adapter = await getDbAdapter(type);
  return adapter;
}
