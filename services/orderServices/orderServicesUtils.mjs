import { randomUUID } from "node:crypto";
import errors from "../../errors/errors.mjs";
import {
  sanitizeAddress,
  toInteger,
  sanitizeString,
  pickNonEmpty,
  EMAIL_REGEX,
} from "../commonUtils.mjs";
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
  catalog,

  // NOW: discount only as { code, value } where value is percent
  discount,
} = {}) {
  if (!Array.isArray(items) || items.length === 0)
    throw errors.invalidData("No items in payload");

  if (!Array.isArray(catalog)) {
    if (catalog && typeof catalog === "object" && catalog.httpStatus) throw catalog;
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

    // pass through discount
    discount,
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

  // NOW: discount only as { code, value } where value is percent
  discount,
} = {}) {
  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw errors.internalError("Product catalog unavailable for manual checkout");
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw errors.invalidData("No items in payload");
  }

  // ---------- Normalize discount ({ code, value } = percent) ----------
  const disc = (discount && typeof discount === "object") ? discount : null;
  const code = typeof disc?.code === "string" ? disc.code : null;
  const percent = Number.isFinite(Number(disc?.value))
    ? Math.max(0, Math.trunc(Number(disc.value)))
    : null;

  // ---------- Addresses / customer ----------
  const byId = new Map(catalog.map((product) => [String(product.id), product]));

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
    cleanBilling.phone
  );
  if (!customerPhone) {
    throw errors.invalidData("Customer phone is required for manual checkout");
  }

  if (!cleanShipping.name) cleanShipping.name = sanitizeString(customerName);
  if (!cleanBilling.name) cleanBilling.name = sanitizeString(customerName);
  const normalizedPhone = sanitizeString(customerPhone);
  if (!cleanShipping.phone) cleanShipping.phone = normalizedPhone;
  if (!cleanBilling.phone) cleanBilling.phone = normalizedPhone;

  // ---------- Items ----------
  const normalizedItems = [];
  let itemsTotalCents = 0;

  for (const { id, qty } of items) {
    const key = String(id);
    const product = byId.get(key);
    if (!product) throw errors.notFound(`Product not found for id ${id}`);

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
      name:
        sanitizeString(product.title || product.name || `Product ${product.id}`) ||
        "Item",
      quantity,
      unit_amount: unitAmount,
    });
  }

  // ---------- Totals (apply percent to MERCHANDISE ONLY) ----------
  const merchandiseTotal = itemsTotalCents;          // products only
  const preDiscountTotal = itemsTotalCents + shippingCost; // products + shipping

  let appliedDiscountCents = 0;
  if (percent && percent > 0 && merchandiseTotal > 0) {
    appliedDiscountCents = Math.floor((merchandiseTotal * percent) / 100);
    // safety cap so we never exceed merchandise
    appliedDiscountCents = Math.max(0, Math.min(appliedDiscountCents, merchandiseTotal));
  }

  const amountTotal = Math.max(0, preDiscountTotal - appliedDiscountCents);
  const currencyNorm = sanitizeString(currency).toLowerCase() || "eur";

  // ---------- Metadata ----------
  const metadata = {
    billing_same_as_shipping: Boolean(billingSameAsShipping),
    shipping_cost_cents: shippingCost,
    shipping_address: { ...cleanShipping },
    billing_address: { ...cleanBilling },
    client_reference_id: sanitizeString(clientReferenceId),
  };

  if (notes) metadata.notes = sanitizeString(notes);

  // Discount audit info
  metadata.discount = {
    code: code ?? null,
    amount_cents: appliedDiscountCents,
    percent: percent ?? null,
    pre_discount_total_cents: preDiscountTotal,
    final_total_cents: amountTotal,
    merchandise_total_cents: merchandiseTotal,
  };

  const resolvedPaymentId =
    sanitizeString(paymentId) || `notPaid_Manual-${randomUUID()}`;

  // ---------- Return payload ----------
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

    // mirrors for convenience
    discount_code: code ?? null,
    discount_amount_cents: appliedDiscountCents,
    discount_percent: percent ?? null,
  };
}
