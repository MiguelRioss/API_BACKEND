import { createHttpError } from "../erros/erros.js";
import { buildOrderPayload } from "../helpers/orderPayload.js";
import { findExistingOrder } from "../helpers/findExistingOrder.js";

export async function handleAsyncSessionSucceeded({ event, stripe, ordersService, stockService, logger }) {
  const session = event.data?.object;
  if (!session?.id) throw createHttpError(400, "Async checkout session payload missing id");

  const lineItemsResponse = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ["data.price"],
  });
  const lineItems = Array.isArray(lineItemsResponse?.data) ? lineItemsResponse.data : [];
  if (lineItems.length === 0) {
    throw createHttpError(400, `No line items found for checkout session ${session.id}`);
  }

  let existing = await findExistingOrder(ordersService, {
    sessionId: session.id,
    paymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
  });

  if (existing) {
    logger?.info?.(
      `[stripe-webhook] Duplicate suppressed for async session ${session.id} (existing order ${existing.id})`
    );
    const alreadyAdjusted = Boolean(existing?.metadata?.stock_adjusted_at);
    if (alreadyAdjusted) return;
    logger?.info?.(`[stripe-webhook] Adjusting stock for async session ${session.id} (first time)`);
  } else {
    const orderPayload = buildOrderPayload(session, lineItems);
    const created = await ordersService.createOrderServices(orderPayload);
    existing = created;
    logger?.info?.(`[stripe-webhook] Created order for async session ${session.id}`);
  }

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
    logger?.warn?.(`[stripe-webhook] Stock decrement failed for async session ${session.id}: ${e?.message ?? e}`);
  }

  try {
    if (existing?.id && typeof ordersService.updateOrderServices === "function") {
      await ordersService.updateOrderServices(existing.id, {
        metadata: { ...(existing.metadata || {}), stock_adjusted_at: new Date().toISOString() },
      });
    }
  } catch {}
}
