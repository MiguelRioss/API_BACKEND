export async function findExistingOrder(ordersService, { sessionId, paymentIntentId }) {
  try {
    const orders = await ordersService.getOrdersServices();
    return orders.find(
      (o) =>
        (sessionId && o?.session_id === sessionId) ||
        (paymentIntentId && o?.payment_intent === paymentIntentId)
    );
  } catch (e) {
    return null; // fail open; webhook should still try to create
  }
}

