import errors from '../../errors/errors.mjs'

export default function createStockServices(db) {
  if (!db) {
    throw errors.internalError("Services dependency invalid");
  }

  return {
    getStockServices,
    updateStock,
    adjustStock,
    getAllProducts,
    getProductById
  };
  /**
   * Get all products with business logic (fewTag / soldOut)
   * @param {boolean} includeSamples - whether to include sample products (default: true)
   */
  async function getAllProducts(includeSamples = true) {
    const raw = await db.getProducts();

    // Optional filtering step
    const filtered = includeSamples
      ? raw
      : raw.filter((p) => !p.isSample);

    // Add computed business fields
    return filtered.map((p) => {
      const stockValue = p.stockValue ?? 0;
      return {
        ...p,
        stockValue,
        fewTag: stockValue < 20,
        soldOut: stockValue === 0,
      };
    });
  }

  async function getProductById(id) {
    const product = await getAllProducts().then(products => products.find(p => {
      if (p.id == 0) console.log(products)
      return p.id === id
    }));

    if (!product) {
      return Promise.reject(errors.notFound(`Product ${id} not found`))
    }

    const stockValue = product.stockValue ?? 0;

    return {
      ...product,
      stockValue,
      fewTag: stockValue < 20,
      soldOut: stockValue === 0,
    };
  }

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
    return db.updateStock(id, updated)
  }

  async function adjustStock(stockID, delta = 0) {
    const id = String(stockID || '').trim();
    if (!id) return Promise.reject(errors.invalidData("Not a valid Id"));

    const n = Number(delta);
    if (isNaN(n) || n === 0) {
      return Promise.reject(errors.invalidData("Delta must be a non-zero number"))
    }

    const target = await db.getStockByID(id);
    const current = Number(target?.stockValue ?? target?.stock ?? 0);
    const next = current + n;

    if (next < 0) {
      return Promise.reject(errors.invalidData(`Not enough stock for ${id}`))
    }

    const updated = { ...target, stockValue: next, updatedAt: new Date().toISOString() };

    return db.updateStock(id, updated);
  }

}