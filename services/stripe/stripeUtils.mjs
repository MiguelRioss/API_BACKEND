import errors from "../../errors/errors.mjs";
import {
  sanitizeAddress,
  sanitizeString,
  toInteger,
  pickNonEmpty,
  EMAIL_REGEX,
} from "../commonUtils.mjs";
const DEFAULT_SUCCESS_URL = `${process.env.PUBLIC_BASE_URL}/checkout/success/{CHECKOUT_SESSION_ID}`;

const DEFAULT_CANCEL_URL = `${process.env.PUBLIC_BASE_URL}/checkout/cancel`;

const EMPTY_ADDRESS = Object.freeze({
  name: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
  phone: "",
});

const stringifyAddress = (address) => JSON.stringify(address ?? EMPTY_ADDRESS);
const withoutPhone = (address = {}) => ({ ...address, phone: "" });

function buildCheckoutMetadata({
  customer,
  shippingAddress,
  billingAddress,
  billingSameAsShipping,
  shippingCostCents,
  clientReferenceId,
  notes,
}) {
  const name = pickNonEmpty(
    customer.name,
    shippingAddress.name,
    billingAddress.name
  );
  if (!name) {
    return {
      error: errors.invalidData("Customer name is required for checkout"),
    };
  }

  const email = pickNonEmpty(customer.email);
  if (!email || !EMAIL_REGEX.test(email)) {
    return {
      error: errors.invalidData("Customer email is required for checkout"),
    };
  }

  const phone = pickNonEmpty(
    customer.phone,
    shippingAddress.phone,
    billingAddress.phone
  );
  if (!phone) {
    return {
      error: errors.invalidData("Customer phone is required for checkout"),
    };
  }

  const metadataShipping = withoutPhone(shippingAddress);
  const metadataBilling = withoutPhone(billingAddress);

  const metadata = {
    name,
    full_name: name,
    email,
    phone,
    notes: sanitizeString(notes),
    billing_same_as_shipping: String(Boolean(billingSameAsShipping)),
    shipping_cost_cents: String(shippingCostCents),
    shipping_address: stringifyAddress(metadataShipping),
    billing_address: stringifyAddress(metadataBilling),
    client_reference_id: sanitizeString(clientReferenceId),
  };

  return { metadata, customerEmail: email };
}

export async function createUrlCheckoutSession({
  stripe,
  line_items,
  customer = {},
  shippingAddress = {},
  billingAddress = {},
  billingSameAsShipping = false,
  shippingCostCents = null,
  clientReferenceId,
  notes,
  successUrl = DEFAULT_SUCCESS_URL,
  cancelUrl = DEFAULT_CANCEL_URL,

  // NEW: discount inputs
  discount,
  discountCode,
  discountAmountCents,
  discountPercent,
}) {
  if (!stripe) {
    return errors.internalError("Stripe client is required");
  }
  if (!Array.isArray(line_items) || line_items.length === 0) {
    return errors.invalidData("line_items must be a non-empty array");
  }

  const cleanShipping = sanitizeAddress(shippingAddress);
  const cleanBilling = billingSameAsShipping
    ? { ...cleanShipping }
    : sanitizeAddress(billingAddress);
  const shippingCost = toInteger(shippingCostCents, 0);

  // ---- Normalize discount (accept nested or flat) --------------------------
  const incomingDiscount =
    (discount && typeof discount === "object" && discount) || {};
  const code =
    (discountCode ?? incomingDiscount.code ?? incomingDiscount.label ?? null) ||
    null;

  const rawAmountCents =
    discountAmountCents ??
    incomingDiscount.amountCents ??
    incomingDiscount.amount_cents ??
    null;

  // number or null
  const uiAmountCents = Number.isFinite(Number(rawAmountCents))
    ? Math.max(0, Math.trunc(Number(rawAmountCents)))
    : 0;

  const rawPercent = discountPercent ?? incomingDiscount.percent ?? null;
  const uiPercent = Number.isFinite(Number(rawPercent))
    ? Math.max(0, Math.trunc(Number(rawPercent)))
    : null;

  // ---- Compute pre-discount total from line_items --------------------------
  const itemsTotalCents = line_items.reduce((sum, li) => {
    const unit = Number(li?.price_data?.unit_amount) || 0;
    const qty = Math.max(1, Math.trunc(Number(li?.quantity) || 1));
    return sum + unit * qty;
  }, 0);

  const preDiscountTotalCents = itemsTotalCents; // includes shipping because we pushed it as a line item already

  // Cap the discount so we never exceed the pre-discount total
  const appliedDiscountCents = Math.min(
    uiAmountCents,
    Math.max(0, preDiscountTotalCents)
  );

  // ---- Build metadata ------------------------------------------------------
  const metaResult = buildCheckoutMetadata({
    customer,
    shippingAddress: cleanShipping,
    billingAddress: cleanBilling,
    billingSameAsShipping,
    shippingCostCents: shippingCost,
    clientReferenceId,
    notes,
  });
  if (metaResult.error) return metaResult.error;

  const { metadata, customerEmail } = metaResult;

  // Append discount details to metadata for auditing
  metadata.discount_code = code || "";
  metadata.discount_amount_cents = String(appliedDiscountCents || 0);
  metadata.discount_percent = uiPercent != null ? String(uiPercent) : "";
  metadata.pre_discount_total_cents = String(preDiscountTotalCents);

  // ---- Optionally create a Stripe coupon for the applied discount ----------
  // Only create a coupon if there's something to discount
  let discountsParam = undefined;
  try {
    if (appliedDiscountCents > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: appliedDiscountCents,
        currency: "eur",
        duration: "once",
        name: code || `Manual discount ${appliedDiscountCents / 100} EUR`,
        metadata: {
          source: "custom_checkout",
          ui_code: code || "",
          ui_percent: uiPercent != null ? String(uiPercent) : "",
        },
      });

      discountsParam = [{ coupon: coupon.id }];
    }
  } catch (e) {
    // If coupon creation fails, surface a clear error
    return errors.externalService("Stripe coupon creation failed", {
      reason: e?.message || "Unknown error",
    });
  }

  // ---- Create the session with the discount applied ------------------------
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      discounts: discountsParam, // <-- APPLY DISCOUNT HERE
      billing_address_collection: "auto",
      phone_number_collection: { enabled: false },
      customer_creation: "always",
      customer_email: customerEmail || undefined,
      client_reference_id: metadata.client_reference_id || undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    });

    if (!session?.url || !session?.id) {
      return errors.externalService("Stripe session created without URL");
    }

    return {
      url: session.url,
      sessionId: session.id,
      paymentIntentId: session.payment_intent || null,
    };
  } catch (stripeError) {
    if (stripeError?.type === "StripeCardError") {
      return errors.stripeCardError(stripeError.message, {
        stripeCode: stripeError.code,
      });
    }
    if (stripeError?.type === "StripeAuthenticationError") {
      return errors.stripeAuthFailed(stripeError.message);
    }
    if (stripeError?.type === "StripeRateLimitError") {
      return errors.stripeRateLimited(stripeError.message);
    }
    return errors.externalService("Stripe session creation failed", {
      reason: stripeError?.message || "Unknown error",
    });
  }
}

export function buildStripeLineItems({
  items,
  byId,
  currency = "eur",
  errorFactory,
}) {
  // ⚙️ Create & THROW the error directly instead of returning it
  const err = (reason, ctx = {}) => {
    const e = errorFactory
      ? errorFactory(reason, ctx)
      : errors.invalidData(ctx.msg || reason);
    throw e; // <-- critical change
  };

  if (!Array.isArray(items) || items.length === 0) {
    err("MALFORMED_INPUT", { msg: "No items in payload" });
  }

  if (!(byId instanceof Map)) {
    err("MALFORMED_INPUT", { msg: "byId must be a Map(productId -> product)" });
  }

  const line_items = [];

  for (const { id, qty } of items) {
    const key = String(id);
    const product = byId.get(key);
    if (!product)
      err("UNKNOWN_PRODUCT", { msg: `Product not found for id ${id}` });

    const priceEuros = Number(product.priceInEuros);
    if (!Number.isFinite(priceEuros) || priceEuros <= 0)
      err("PRICE_MISMATCH", { msg: `Invalid price for product ${id}` });

    const quantity = Math.max(1, Math.trunc(Number(qty) || 1));

    if (product.soldOut)
      err("OUT_OF_STOCK", {
        msg: `${product.name || product.title} is sold out`,
      });

    const stockValueNum = Number(product.stockValue);
    if (Number.isFinite(stockValueNum) && stockValueNum < quantity)
      err("OUT_OF_STOCK", {
        msg: `Not enough stock for ${product.name || product.title}`,
      });

    const unit_amount = Math.round(priceEuros * 100);

    line_items.push({
      price_data: {
        currency,
        product_data: {
          name: product.title || product.name,
          metadata: { productId: String(product.id) },
        },
        unit_amount,
      },
      quantity,
    });
  }

  return line_items;
}
