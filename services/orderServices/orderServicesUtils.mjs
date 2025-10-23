import { randomUUID } from "node:crypto";
import errors from "../../errors/errors.mjs";
import { sanitizeAddress, toInteger, sanitizeString, pickNonEmpty, EMAIL_REGEX } from "../commonUtils.mjs";
import { PAYMENT_TYPE } from "../commonUtils.mjs";

export default async function buildManualOrderFromCart({
  
    items = [],
    customer = {},
    shippingAddress = {},
    billingAddress = {},
    billingSameAsShipping = false,
    shippingCostCents = 0,
    notes,
    clientReferenceId,
    currency = "eur",
    paymentId,
    catalog
    } = {}) {
    if (!Array.isArray(items) || items.length === 0)
      throw errors.invalidData("No items in payload");

    if (!Array.isArray(catalog)) {
      if (catalog && typeof catalog === "object" && catalog.httpStatus)
        throw catalog;
      throw errors.internalError("Catalog fetch failed (not an array)");
    }

    return buildManualOrderPayload({
      items,
      catalog,
      customer,
      shippingAddress,
      billingAddress,
      billingSameAsShipping,
      shippingCostCents,
      notes,
      clientReferenceId,
      currency,
      paymentId,
    });
  }

export function buildManualOrderPayload({
  items = [],
  catalog = [],
  customer = {},
  shippingAddress = {},
  billingAddress = {},
  billingSameAsShipping = false,
  shippingCostCents = 0,
  notes,
  clientReferenceId,
  currency = "eur",
  paymentId,
} = {}) {
  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw errors.internalError("Product catalog unavailable for manual checkout");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw errors.invalidData("No items in payload");
  }

  const byId = new Map(
    catalog.map((product) => [String(product.id), product])
  );

  const cleanShipping = sanitizeAddress(shippingAddress);
  const cleanBilling = billingSameAsShipping
    ? { ...cleanShipping }
    : sanitizeAddress(billingAddress);

  const shippingCost = toInteger(shippingCostCents, 0);

  const customerName = pickNonEmpty(
    customer.name,
    cleanShipping.name,
    cleanBilling.name
  );
  if (!customerName) {
    throw errors.invalidData("Customer name is required for manual checkout");
  }

  const customerEmail = pickNonEmpty(customer.email);
  if (!customerEmail || !EMAIL_REGEX.test(customerEmail)) {
    throw errors.invalidData("Valid customer email is required for manual checkout");
  }

  const customerPhone = pickNonEmpty(
    customer.phone,
    cleanShipping.phone,
    cleanBilling.phone,
  );
  if (!customerPhone) {
    throw errors.invalidData("Customer phone is required for manual checkout");
  }

  if (!cleanShipping.name) cleanShipping.name = sanitizeString(customerName);
  if (!cleanBilling.name) cleanBilling.name = sanitizeString(customerName);
  const normalizedPhone = sanitizeString(customerPhone);
  if (!cleanShipping.phone) cleanShipping.phone = normalizedPhone;
  if (!cleanBilling.phone) cleanBilling.phone = normalizedPhone;

  const normalizedItems = [];
  let itemsTotalCents = 0;

  for (const { id, qty } of items) {
    const key = String(id);
    const product = byId.get(key);
    if (!product) {
      throw errors.notFound(`Product not found for id ${id}`);
    }

    const quantity = Math.max(1, Math.trunc(Number(qty) || 1));
    const priceEuros = Number(product.priceInEuros);
    if (!Number.isFinite(priceEuros) || priceEuros <= 0) {
      throw errors.invalidData(`Invalid price for product ${id}`);
    }

    const unitAmount = Math.round(priceEuros * 100);
    const lineTotal = unitAmount * quantity;

    itemsTotalCents += lineTotal;

    normalizedItems.push({
      id: Number(product.id),
      name: sanitizeString(product.title || product.name || `Product ${product.id}`) || "Item",
      quantity,
      unit_amount: unitAmount,
    });
  }

  const amountTotal = itemsTotalCents + shippingCost;
  const currencyNorm = sanitizeString(currency).toLowerCase() || "eur";

  const metadata = {
    billing_same_as_shipping: Boolean(billingSameAsShipping),
    shipping_cost_cents: shippingCost,
    shipping_address: { ...cleanShipping },
    billing_address: { ...cleanBilling },
    client_reference_id: sanitizeString(clientReferenceId),
  };

  if (notes) {
    metadata.notes = sanitizeString(notes);
  }

  const resolvedPaymentId = sanitizeString(paymentId) || `notPaid_Manual-${randomUUID()}`;

  return {
    name: sanitizeString(customerName),
    email: customerEmail.trim().toLowerCase(),
    phone: sanitizeString(customerPhone),
    amount_total: amountTotal,
    currency: currencyNorm,
    items: normalizedItems,
    shipping_cost_cents: shippingCost,
    payment_id: resolvedPaymentId,
    payment_status: false,
    metadata,
    payment_type: PAYMENT_TYPE.MANUAL,
  };
}
