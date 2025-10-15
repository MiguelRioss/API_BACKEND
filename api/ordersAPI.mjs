import handlerFactory from "../utils/handleFactory.mjs";

// api/ordersApi.mjs
export default function createOrdersAPI(ordersService) {
    if (!ordersService || typeof ordersService.getOrdersServices !== "function") {
        throw "API dependency invalid";
    }

    return {
        getOrdersAPI: handlerFactory(interalGetOrders),
        getOrderByIdAPI: handlerFactory(internalGetOrderByID),
        getOrderBySessionIdAPI: handlerFactory(internalGetOrderBySessionId),
        createOrderAPI: handlerFactory(internalCreateOrder),
        updateOrderAPI: handlerFactory(internalUpdateOrder)
    };

    async function interalGetOrders(req, rsp) {
        // await the async service method!
        return ordersService.getOrdersServices()
            .then(
                orders => rsp.json(orders)
            );
    }
    // in api/ordersApi.mjs
    async function internalGetOrderByID(req, rsp) {
        const id = req.params.id;
        return ordersService.getOrderByIdServices(id)
            .then(order => rsp.json(order)); // will throw NotFoundError if missing
    }

    async function internalGetOrderBySessionId(req) {
        const sessionId = req.params.sessionId ?? req.params.id;
        return ordersService.getOrderByStripeSessionId(sessionId);
    }

    async function internalCreateOrder(req, rsp) {
        let orderObj = req.body;
        // The handler does not catch errors; createHandler wrapper sends errors to central error handler.
        return ordersService.createOrderServices(orderObj).then(
            orderObj => rsp.status(201).json({
                id: orderObj.id,
                description: "Order Created",
                uri: `/api/orders/${orderObj.id}`
            })
        )
    }

    async function internalUpdateOrder(req, rsp) {
        const orderID = req.params.id;
        const orderChanges = req.body.changes;

        const updatedOrder = await ordersService.updateOrderServices(orderID, orderChanges);

        return rsp.status(200).json({
            message: `Order with id ${updatedOrder.id} updated successfully`,
            ...updatedOrder,
        })
    }

}
