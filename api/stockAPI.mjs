import errors from "../errors/errors.mjs";
import handlerFactory from "../utils/handleFactory.mjs";

export default function createStocksAPI(stockService) {

  
  if (!stockService) {
    return errors.internalError("API dependency invalid");
  }

  return {
    getStockAPI: handlerFactory(internalGetStock),
    updateStockAPI: handlerFactory(internalUpdateStock),
    adjustStockAPI: handlerFactory(internalAdjustStock),
    getProductsAPI: handlerFactory(internalGetProducts),
    getProductByIdAPI: handlerFactory(internalGetProductById),
    updateProductAPI: handlerFactory(internalUpdateProduct),
  };

  async function internalGetStock(req, rsp) {
    const stocks = await stockService.getStockServices();
    return rsp.json(stocks);
  }

  async function internalUpdateStock(req, rsp) {
    const stockID = req.params.id;
    const changes = req.body?.changes || {};
    const updated = await stockService.updateStock(stockID, changes);
    return rsp.json(updated);
  }

  async function internalAdjustStock(req, rsp) {
    const stockID = req.params.id;
    const delta = req.body?.delta ?? 0; // + for increment, - for decrement
    const updated = await stockService.adjustStock(stockID, delta);
    return rsp.json(updated);
  }
// routes/products.js  (or wherever your internalGetProducts lives)
async function internalGetProducts(req, rsp) {
  const includeSamples = req.query.samples === "true";
  const products = await stockService.getAllProducts(includeSamples);
  return rsp.json(filteredProducts);
}
  async function internalGetProductById(req, rsp) {
    const productID = req.params.id;
    const product = await stockService.getProductById(productID);
    return rsp.json(product);
  }

  async function internalUpdateProduct(req, rsp) {
    const productID = req.params.id;
    const changes = req.body?.changes || {};
    const updated = await stockService.updateProduct(productID, changes);
    return rsp.json(updated);
  }
}
