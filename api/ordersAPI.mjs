// api/ordersAPI.mjs
export default function createOrdersAPI(ordersService) {
    if (!ordersService || typeof ordersService.getOrdersServices !== "function") {
        throw new Error("createOrdersAPI expects the ordersService with getOrdersServices()");
    }

    return {
        getOrdersAPI,
        getOrderByIdAPI,
        createOrderAPI
    };

    async function getOrdersAPI(req, res) {
        // await the async service method!
        const orders = await ordersService.getOrdersServices();
        // return a value — your handler factory will JSON-serialize it
        return { ok: true, orders };
    }
    // in api/ordersAPI.mjs
    async function getOrderByIdAPI(req, res) {
        const id = req.params.id;
        const order = await ordersService.getOrderByIdServices(id); // will throw NotFoundError if missing
        return { ok: true, order };
    }

    async function createOrderAPI(req, res) {
        const orderPayload = req.body;

        // The handler does not catch errors; createHandler wrapper sends errors to central error handler.
        const created = await ordersService.createOrderServices(orderPayload);
        // created is the exact saved order object
        return { ok: true, order: created };
    }

}
