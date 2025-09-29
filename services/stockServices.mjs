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
  async function decrementStock(stockID, delta = 0, hintName = undefined) {
    const id = String(stockID || '').trim();
    const n = Number(delta) || 0;
    if (n <= 0) return id ? db.getStockByID(id) : getFirstStock();

    let target = null;
    if (id) {
      try {
        target = await db.getStockByID(id);
      } catch (e) {
        // fall back to search by name if id not found
      }
    }

    if (!target) {
      const all = await db.getStocks();
      const norm = (s) => (s || '').toString().trim().toLowerCase();
      const h = norm(hintName);
      // try exact name match, then includes
      target = all.find((s) => norm(s.name) === h) || all.find((s) => h && norm(s.name).includes(h));
      if (!target && id) {
        target = all.find((s) => String(s.id) === id);
      }
      if (!target) return null; // nothing to decrement
      // fetch full record to get raw fields (stockValue, etc.)
      target = await db.getStockByID(target.id);
    }

    const current = Number(target?.stockValue ?? target?.stock ?? 0);
    const next = Math.max(0, current - n);
    const updated = { ...target, stockValue: next, updatedAt: new Date().toISOString() };
    delete updated.id;
    return db.updateStock(target.id, updated);
  }

  async function getFirstStock(){
    const all = await db.getStocks();
    if (!all || all.length === 0) return null;
    return db.getStockByID(all[0].id);
  }
}
