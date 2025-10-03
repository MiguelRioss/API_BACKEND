import errors from '../errors/errors.mjs'

export default function createStockServices(db) {
  if (!db) {
    throw "Services dependency invalid";
  }

  return {
    getStockServices,
    updateStock,
    adjustStock,
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

  async function adjustStock(stockID, delta = 0) {
    const id = String(stockID || '').trim();
    if (!id) return errors.INVALID_DATA("Not a valid Id");

    const n = Number(delta);
    if (isNaN(n) || n === 0) {
      return errors.INVALID_DATA("Delta must be a non-zero number");
    }

    const target = await db.getStockByID(id);
    const current = Number(target?.stockValue ?? target?.stock ?? 0);
    const next = current + n;

    if (next < 0) {
      return errors.INVALID_DATA(`Not enough stock for ${id}`);
    }

    const updated = { ...target, stockValue: next, updatedAt: new Date().toISOString() };
    delete updated.id;

    return db.updateStock(id, updated);
  }

}