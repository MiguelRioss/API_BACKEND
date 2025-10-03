import { createHttpError } from "../erros/erros.js";
import { buildOrderPayload } from "../helpers/orderPayload.js";
import { findExistingOrder } from "../helpers/findExistingOrder.js";

export async function handlePaymentIntentSucceeded({ event, stripe, ordersService, stockService, logger }) {
  const pi = event.data?.object;
  const paymentIntentId = typeof pi?.id === "string" ? pi.id : undefined;
  if (!paymentIntentId) throw createHttpError(400, "payment_intent.succeeded missing id");

  const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 });
  const session = Array.isArray(sessions?.data) ? sessions.data[0] : undefined;
  if (!session) {
    logger?.info?.(
      `[stripe-webhook] payment_intent.succeeded (${paymentIntentId}) without Checkout Session — skipping order creation`
    );
    return;
  }

  const lineItemsResponse = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ["data.price"],
  });
  const lineItems = Array.isArray(lineItemsResponse?.data) ? lineItemsResponse.data : [];
  if (lineItems.length === 0) {
    throw createHttpError(400, `No line items found for checkout session ${session.id}`);
  }

  const existing = await findExistingOrder(ordersService, {
    sessionId: session.id,
    paymentIntentId,
  });
  if (existing) {
    logger?.info?.(
      `[stripe-webhook] Duplicate suppressed for payment_intent ${paymentIntentId} (existing order ${existing.id})`
    );
    return;
  }

  const orderPayload = buildOrderPayload(session, lineItems);
  const created = await ordersService.createOrderServices(orderPayload);
  logger?.info?.(
    `[stripe-webhook] Created order via payment_intent.succeeded for session ${session.id}`
  );

  try {
    if (stockService?.decrementStock) {
      await Promise.allSettled(
        lineItems.map((l) =>
          stockService.decrementStock(
            l.price?.product ?? l.price?.id ?? l.id,
            l.quantity,
            l.description ?? l.price?.nickname ?? undefined
          )
        )
      );
    }
  } catch (e) {
    logger?.warn?.(
      `[stripe-webhook] Stock decrement failed for PI ${paymentIntentId}: ${e?.message ?? e}`
    );
  }

  try {
    if (created?.id && typeof ordersService.updateOrderServices === "function") {
      await ordersService.updateOrderServices(created.id, {
        metadata: { ...(created.metadata || {}), stock_adjusted_at: new Date().toISOString() },
      });
    }
  } catch {}
}
