import { ensureNonEmpty } from "./strings.js";
import { buildItems } from "./items.js";
import { buildMetadata } from "./metadata.js";
import { createHttpError } from "../erros/erros.js";

export function buildOrderPayload(session, lineItems) {
  const name = ensureNonEmpty(
    session.shipping_details?.name ?? session.customer_details?.name ?? session.metadata?.full_name,
    "Missing customer name in checkout session"
  );

  const email = ensureNonEmpty(
    session.customer_details?.email ?? session.customer_email,
    "Missing customer email in checkout session"
  );

  const currency = ensureNonEmpty(session.currency, "Missing currency in checkout session").toLowerCase();

  const { items, amount_total } = buildItems(lineItems);
  if (items.length === 0) {
    throw createHttpError(400, "Checkout session has no purchasable items");
  }

  const metadata = buildMetadata(session, { name, email });

  const orderPayload = {
    name,
    email,
    currency,
    amount_total,
    items,
    metadata,
    session_id: session.id,
    payment_status: session.payment_status,
  };

  if (session.payment_intent) {
    orderPayload.payment_intent =
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  }
  if (session.customer) orderPayload.customer = session.customer;
  if (session.client_reference_id) orderPayload.client_reference_id = session.client_reference_id;

  return orderPayload;
}
