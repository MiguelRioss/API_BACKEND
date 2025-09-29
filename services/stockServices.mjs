// services/stockServices.mjs

export default function createStockServices(db) {
  if (!db) {
    throw "Services dependency invalid";
  }

  return {
    getStockServices,
    updateStock,
    decrementStock,
  };

  async function getStockServices() {
    return db.getStocks();
  }

  /**
   * Update stock item by id with provided changes.
   * Accepts payloads like: { changes: { stockValue: 1 } }
   */
  async function updateStock(stockID, stockChanges = {}) {
    const id = String(stockID).trim();
    const changes = stockChanges && typeof stockChanges === "object" ? stockChanges : {};

    const existing = await db.getStockByID(id);
    const updated = { ...existing, ...changes, updatedAt: new Date().toISOString() };
    delete updated.id; // data stored under the id key in RTDB
    return db.updateStock(id, updated);
  }

  /**
   * Decrement stockValue by a positive integer delta.
   */
  async function decrementStock(stockID, delta = 0) {
    const id = String(stockID).trim();
    const n = Number(delta) || 0;
    if (n <= 0) return db.getStockByID(id); // no-op
    const existing = await db.getStockByID(id);
    const current = Number(existing?.stockValue ?? 0);
    const next = Math.max(0, current - n);
    const updated = { ...existing, stockValue: next, updatedAt: new Date().toISOString() };
    delete updated.id;
    return db.updateStock(id, updated);
  }
}
