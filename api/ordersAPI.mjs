// api/ordersApi.mjs
import handlerFactory from "../utils/handleFactory.mjs";
import prepareCheckOut from "./prepareCheckOut.mjs";

const ALLOWED_FOLDERS = new Set(["orders", "archive", "deleted"]);
function normalizeFolderName(v) {
  const x = String(v ?? "")
    .trim()
    .toLowerCase();
  if (x === "archived") return "archive";
  return ALLOWED_FOLDERS.has(x) ? x : null;
}

export default function createOrdersAPI(ordersService) {
  if (!ordersService || typeof ordersService.getOrdersServices !== "function") {
    throw "API dependency invalid";
  }

  return {
    getOrdersAPI: handlerFactory(interalGetOrders),
    getOrderByIdAPI: handlerFactory(internalGetOrderByID),
    getOrderBySessionIdAPI: handlerFactory(internalGetOrderBySessionId),
    createOrderAPI: handlerFactory(internalCreateOrder),
    updateOrderAPI: handlerFactory(internalUpdateOrder),
    handleCheckoutSession: handlerFactory(handleCheckoutSession),
    getOrdersByFolderAPI: handlerFactory(internalGetOrdersByFolder),
    // NEW:
    moveOrdersAPI: handlerFactory(internalMoveOrders),
  };

  async function handleCheckoutSession(req, rsp) {
    const body = req.body ?? {};
    const orderData = prepareCheckOut(body);
    return ordersService.createCheckoutSession(orderData);
  }

  async function internalGetOrdersByFolder(req, rsp) {
    const raw = req.params.folderName;
    const folderName = normalizeFolderName(raw);
    if (!folderName) {
      return rsp.status(400).json({
        error: `Invalid folder '${raw}'. Allowed: orders | archive | deleted`,
      });
    }
    const items = await ordersService.getOrdersByFolderService(folderName);
    return rsp.json({ items, folder: folderName });
  }

  async function interalGetOrders(req, rsp) {
    // Optional: support ?folder=... here too (falls back to existing behaviour)
    const queryFolder = req.query?.folder;
    if (queryFolder) {
      const folderName = normalizeFolderName(queryFolder);
      if (!folderName) {
        return rsp.status(400).json({
          error: `Invalid folder '${queryFolder}'. Allowed: orders | archive | deleted`,
        });
      }
      const items = await ordersService.getOrdersByFolderService(folderName);
      return rsp.json({ items, folder: folderName });
    }

    const orders = await ordersService.getOrdersServices();
    return rsp.json(orders);
  }

  async function internalGetOrderByID(req, rsp) {
    const id = req.params.id;
    const order = await ordersService.getOrderByIdServices(id);
    return rsp.json(order); // will throw NotFoundError if missing
  }

  async function internalGetOrderBySessionId(req) {
    const sessionId = req.params.sessionId ?? req.params.id;
    return ordersService.getOrderByStripeSessionId(sessionId);
  }
  // api/routes/ordersApi.js (or wherever internalCreateOrder lives)
  async function internalCreateOrder(req, rsp) {
    const orderObj = req.body;
    const { isRequestedOrderForOtherCountries = false, isSample = false } =
      req.body;

    const saved = await ordersService.createOrderServices(orderObj, {
      isRequestedOrderForOtherCountries,
      isSample, // 👈 pass down to service
    });

    return rsp.status(201).json({
      id: saved.id,
      description: "Order Created",
      uri: `/api/orders/${saved.id}`,
    });
  }

  async function internalUpdateOrder(req, rsp) {
    const orderID = req.params.id;
    const orderChanges = req.body.changes;
    const updatedOrder = await ordersService.updateOrderServices(
      orderID,
      orderChanges
    );
    return rsp.status(200).json({
      message: `Order with id ${updatedOrder.id} updated successfully`,
      ...updatedOrder,
    });
  }

  // NEW: bulk move between folders
  // POST /api/orders/move
  // { "ids": ["123","456"], "source": "orders", "dest": "archive" }
  async function internalMoveOrders(req, rsp) {
    const { ids, source, dest } = req.body ?? {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return rsp
        .status(400)
        .json({ error: "Body must include non-empty array 'ids'." });
    }

    const src = normalizeFolderName(source);
    const dst = normalizeFolderName(dest);
    if (!src || !dst) {
      return rsp.status(400).json({
        error: `Invalid folder(s). Allowed: orders | archive | deleted`,
      });
    }

    const result = await ordersService.moveOrdersService({
      ids,
      source: src,
      dest: dst,
    });
    return rsp.json(result);
  }
}
