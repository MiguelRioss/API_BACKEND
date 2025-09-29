import handlerFactory from "../utils/handleFactory.mjs";

// api/stockAPI.mjs
export default function createStocksAPI(stockService) {
    if (!stockService) {
       throw "API dependency invalid";
    }

    return {
       getStockAPI : handlerFactory(interalGetStock),
       updateStockAPI : handlerFactory(interalUpdateStock)
    };

    async function interalGetStock(req, rsp) {
        // await the async service method!
        return stockService.getStockServices()
            .then(
                orders => rsp.json(orders)
            );
    }

    async function interalUpdateStock(req, rsp) {
        const stockID = req.params.id;
        const changes = req.body?.changes || {};
        return stockService.updateStock(stockID, changes)
            .then(updated => rsp.json(updated));
    }
}
