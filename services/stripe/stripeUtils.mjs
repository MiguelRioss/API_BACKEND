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

  // receives { code, value } where value = percent
  discount,
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

  // ---- Normalize discount: { code, value } (percent) -----------------------
  const incomingDiscount = (discount && typeof discount === "object" && discount) || {};
  const code = incomingDiscount.code ? String(incomingDiscount.code).trim() : "";
  const uiPercent = Number.isFinite(Number(incomingDiscount.value))
    ? Math.max(0, Math.trunc(Number(incomingDiscount.value)))
    : null;

  // ---- Totals (exclude shipping line from merchandise total) ---------------
  const merchandiseTotalCents = line_items.reduce((sum, li) => {
    const pid = li?.price_data?.product_data?.metadata?.productId;
    if (pid === "__shipping__") return sum; // exclude shipping
    const unit = Number(li?.price_data?.unit_amount) || 0;
    const qty  = Math.max(1, Math.trunc(Number(li?.quantity) || 1));
    return sum + unit * qty;
  }, 0);

  // Keep full pre-discount total for audit (includes shipping)
  const preDiscountTotalCents = line_items.reduce((sum, li) => {
    const unit = Number(li?.price_data?.unit_amount) || 0;
    const qty  = Math.max(1, Math.trunc(Number(li?.quantity) || 1));
    return sum + unit * qty;
  }, 0);

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

  // Audit fields
  metadata.discount_code = code || "";
  metadata.discount_percent = uiPercent != null ? String(uiPercent) : "";
  metadata.pre_discount_total_cents = String(preDiscountTotalCents);
  metadata.merchandise_total_cents = String(merchandiseTotalCents);

  // ---- Create coupon as AMOUNT OFF on merchandise only ---------------------
  let discountsParam = undefined;
  try {
    let appliedDiscountCents = 0;

    if (uiPercent && uiPercent > 0 && merchandiseTotalCents > 0) {
      appliedDiscountCents = Math.floor((merchandiseTotalCents * uiPercent) / 100);
      // safety caps
      appliedDiscountCents = Math.max(0, Math.min(appliedDiscountCents, merchandiseTotalCents));
    }

    if (appliedDiscountCents > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: appliedDiscountCents,   // amount off (so shipping isn't discounted)
        currency: "eur",
        duration: "once",
        name: code || `Manual discount €${(appliedDiscountCents / 100).toFixed(2)}`,
        metadata: {
          source: "custom_checkout",
          ui_code: code || "",
          ui_percent: String(uiPercent ?? ""),
        },
      });

      discountsParam = [{ coupon: coupon.id }];
    }
  } catch (e) {
    return errors.externalService("Stripe coupon creation failed", {
      reason: e?.message || "Unknown error",
    });
  }

  // ---- Create the session (apply coupon via discounts) ---------------------
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      discounts: discountsParam,
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
