// utils/prepareStripeCheckoutOrder.mjs
export default function prepareCheckOut(body = {}) {
  const items = Array.isArray(body.items) ? body.items : [];

  const customer =
    body.customer && typeof body.customer === "object" ? body.customer : {};

  const clientReferenceId =
    body.clientReferenceId ?? body.client_reference_id ?? undefined;

  const shippingAddress =
    (body.shipping_address &&
      typeof body.shipping_address === "object" &&
      body.shipping_address) ||
    (body.address && typeof body.address === "object" && body.address) ||
    {};

  const billingAddress =
    (body.billing_address &&
      typeof body.billing_address === "object" &&
      body.billing_address) ||
    (body.billingAddress &&
      typeof body.billingAddress === "object" &&
      body.billingAddress) ||
    {};

  const billingSameAsShipping = Boolean(
    body.billingSameAsShipping ?? body.billing_same_as_shipping ?? false
  );

  const rawShippingCost = body.shipping_cost_cents ?? body.shippingCostCents;
  const shippingCostCents = Number.isFinite(Number(rawShippingCost))
    ? Number(rawShippingCost)
    : null;

  const notes =
    typeof body.notes === "string"
      ? body.notes
      : typeof customer.notes === "string"
      ? customer.notes
      : undefined;

  // ── Safe discount extraction ───────────────────────────────────────────────
  const disc = body && typeof body.discount === "object" ? body.discount : null;
  const rawCode = disc?.code;
  const rawVal = disc?.value;

  let discount = null;
  if (rawCode && Number.isFinite(Number(rawVal)) && Number(rawVal) > 0) {
    discount = {
      code: String(rawCode).trim().toUpperCase(), // or keep case if you prefer
      value: Math.trunc(Number(rawVal)), // percent
    };
  }

  return {
    items,
    clientReferenceId,
    customer,
    shippingAddress,
    billingAddress,
    billingSameAsShipping,
    shippingCostCents,
    notes,
    discount, // null when not provided/invalid
  };
}
