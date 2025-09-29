// api/services/ordersServiceFactory.mjs

/**
 * createOrdersService(db)
 * - db must expose:
 *    - async getStockServices(): Promise<Array>
 *
 * Returns:
 *  - getStockServices()
 *
 * Service throws domain errors for HTTP layer to map.
 */
export default function createStockServices(db) {
    if (!db) {
        throw "Services dependency invalid";
    }

    return {
        getStockServices,
    };
    /**
    * Fetches orders and applies filters, sorting, and limit in a chained style.
    *
    * @async
    * @param {Object} [options]
    * @param {number} [options.limit] - Maximum number of orders.
    * @param {string|boolean} [options.status] - Status filter.
    * @param {string} [options.q] - Query string.
    * @returns {Promise<Object[]>} Filtered, sorted, and limited orders.
    */
    async function getStockServices({ limit, q } = {}) {
        return db.getStocks()
            .then(stock => {
                return stock
            });
    }
}




