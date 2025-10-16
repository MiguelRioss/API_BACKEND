// utils/prepareStripeCheckoutOrder.mjs
export default function prepareStripeCheckoutOrder(body = {}) {
  const items = Array.isArray(body.items) ? body.items : [];

  const customer =
    body.customer && typeof body.customer === "object" ? body.customer : {};

  const clientReferenceId =
    body.clientReferenceId ?? body.client_reference_id ?? undefined;

  const shippingAddress =
    (body.shipping_address && typeof body.shipping_address === "object" && body.shipping_address) ||
    (body.address && typeof body.address === "object" && body.address) ||
    {};

  const billingAddress =
    (body.billing_address && typeof body.billing_address === "object" && body.billing_address) ||
    (body.billingAddress && typeof body.billingAddress === "object" && body.billingAddress) ||
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

  return {
    items,
    clientReferenceId,
    customer,
    shippingAddress,
    billingAddress,
    billingSameAsShipping,
    shippingCostCents,
    notes,
  };
}
