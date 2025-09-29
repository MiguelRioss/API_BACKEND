import handlerFactory from "../utils/handleFactory.mjs";

// api/ordersAPI.mjs
export default function createStocksAPI(stockService) {
    if (!stockService) {
       throw "API dependency invalid";
    }

    return {
       getStockAPI : handlerFactory(interalGetStock),
    };

    async function interalGetStock(req, rsp) {
        // await the async service method!
        return stockService.getStockService()
            .then(
                orders => rsp.json(orders)
            );
    }
}
