// api/ordersAPI.mjs
export default function createOrdersAPI(ordersService) {
    if (!ordersService || typeof ordersService.getOrdersServices !== "function") {
        throw new Error("createOrdersAPI expects the ordersService with getOrdersServices()");
    }

    return {
        getOrdersAPI,
        getOrderByIdAPI,
        createOrderAPI,
        updateOrderAPI
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
        try {   // accepts full order object in request body
            const order = req.body;
            console.info('[DEBUG CREATE ORDER] incoming body:', JSON.stringify(order));
            // The handler does not catch errors; createHandler wrapper sends errors to central error handler.
            const created = await ordersService.createOrderServices(order);
            // created is the exact saved order object
            return res.status(201).json({ok :true, order : created})
        } catch (err) {
            console.error('[DEBUG CREATE ORDER] ERROR ->', err && err.stack ? err.stack : err);
            const details = {
                message: err && err.message,
                name: err && err.name,
                code: err && err.code,
                status: err && err.status,
                // include any vendor error fields (e.g. firebase code)
                firebase: err && err.details ? err.details : undefined,
            };
            return res.status(500).json({ ok: false, debug_error: details });
        }
    }

     async function updateOrderAPI(req, res) {
        try {   // accepts full order object in request body
            const orderID = req.params.id;
            const orderChanges = req.body.changes
            // The handler does not catch errors; createHandler wrapper sends errors to central error handler.
            const updated = await ordersService.updateOrderServices(orderID,orderChanges)
            // created is the exact saved order object
            return res.status(200).json({ok :true, order : updated})
        } catch (err) {
            const details = {
                message: err && err.message,
                name: err && err.name,
                code: err && err.code,
                status: err && err.status,
                firebase: err && err.details ? err.details : undefined,
            };
            return res.status(500).json({ ok: false, debug_error: details });
        }
    }
}
