import errors from "../errors/errors.mjs";

const DEFAULT_SUCCESS_URL =
  `${process.env.PUBLIC_BASE_URL}/#/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
const DEFAULT_CANCEL_URL = `${process.env.PUBLIC_BASE_URL}/#/checkout/cancel`;
const DEFAULT_ALLOWED_COUNTRIES = (process.env.STRIPE_ALLOWED_SHIP_COUNTRIES || "PT,ES,FR,DE,GB")
  .split(",")
  .map((code) => code.trim().toUpperCase())
  .filter(Boolean);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const sanitizeString = (value) => (typeof value === "string" ? value.trim() : "");

const pickNonEmpty = (...values) => {
  for (const value of values) {
    const trimmed = sanitizeString(value);
    if (trimmed) {
      return trimmed;
    }
  }
  return "";
};

const toInteger = (value, fallback = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const int = Math.trunc(num);
  return int < 0 ? fallback : int;
};

const sanitizeAddress = (address = {}) => {
  if (!address || typeof address !== "object") {
    return { ...EMPTY_ADDRESS };
  }

  return {
    name: sanitizeString(address.name),
    line1: sanitizeString(address.line1),
    line2: sanitizeString(address.line2),
    city: sanitizeString(address.city),
    state: sanitizeString(address.state ?? address.region ?? address.province),
    postal_code: sanitizeString(address.postal_code ?? address.postalCode ?? address.zip),
    country: sanitizeString(address.country).toUpperCase(),
    phone: sanitizeString(address.phone),
  };
};

const hasAddressCore = (address = EMPTY_ADDRESS) =>
  Boolean(address.line1 || address.city || address.postal_code || address.country);

const deriveAllowedCountries = (...addresses) => {
  const codes = new Set();
  for (const address of addresses) {
    if (!address) continue;
    const code = sanitizeString(address.country).toUpperCase();
    if (code.length === 2) {
      codes.add(code);
    }
  }

  if (codes.size > 0) {
    return [...codes];
  }

  return DEFAULT_ALLOWED_COUNTRIES;
};

const stringifyAddress = (address) => JSON.stringify(address ?? EMPTY_ADDRESS);

function buildCheckoutMetadata({
  customer,
  shippingAddress,
  billingAddress,
  billingSameAsShipping,
  shippingCostCents,
  clientReferenceId,
  notes,
}) {
  const name = pickNonEmpty(customer.name, shippingAddress.name, billingAddress.name);
  if (!name) {
    return { error: errors.invalidData("Customer name is required for checkout") };
  }

  const email = pickNonEmpty(customer.email);
  if (!email || !EMAIL_REGEX.test(email)) {
    return { error: errors.invalidData("Customer email is required for checkout") };
  }

  const phone = pickNonEmpty(customer.phone, shippingAddress.phone, billingAddress.phone);
  if (!phone) {
    return { error: errors.invalidData("Customer phone is required for checkout") };
  }

  const metadata = {
    name,
    email,
    phone,
    notes: sanitizeString(notes),
    billing_same_as_shipping: String(Boolean(billingSameAsShipping)),
    shipping_cost_cents: String(shippingCostCents),
    shipping_address: stringifyAddress(shippingAddress),
    billing_address: stringifyAddress(billingAddress),
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

  const allowedCountries = deriveAllowedCountries(cleanShipping, cleanBilling);
  const shippingCollection = allowedCountries.length
    ? { allowed_countries: allowedCountries }
    : undefined;

  const shippingCost = toInteger(shippingCostCents, 0);

  const metaResult = buildCheckoutMetadata({
    customer,
    shippingAddress: cleanShipping,
    billingAddress: cleanBilling,
    billingSameAsShipping,
    shippingCostCents: shippingCost,
    clientReferenceId,
    notes,
  });

  if (metaResult.error) {
    return metaResult.error;
  }

  const { metadata, customerEmail } = metaResult;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      billing_address_collection: "auto",
      shipping_address_collection: shippingCollection,
      phone_number_collection: { enabled: false },
      customer_creation: "always",
      customer_email: customerEmail || undefined,
      client_reference_id: metadata.client_reference_id || undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    });

    if (!session?.url) {
      return errors.externalService("Stripe session created without URL");
    }

    return session.url;
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
  const err = (msg, details) =>
    errorFactory ? errorFactory(msg, details) : errors.invalidData(msg, details);

  if (!Array.isArray(items) || items.length === 0) {
    return err("No items in payload");
  }
  if (!(byId instanceof Map)) {
    return err("byId must be a Map(productId -> product)");
  }

  const line_items = [];

  for (const { id, qty } of items) {
    const key = String(id);
    const product = byId.get(key);
    if (!product) return err(`Product not found for id ${id}`);

    const priceEuros = Number(product.priceInEuros);
    if (!Number.isFinite(priceEuros) || priceEuros <= 0) {
      return err(`Invalid price for product ${id}`);
    }

    const quantity = Math.max(1, Math.trunc(Number(qty) || 1));

    if (product.soldOut) {
      return err(`${product.name || product.title} is sold out`);
    }
    const stockValueNum = Number(product.stockValue);
    if (Number.isFinite(stockValueNum) && stockValueNum < quantity) {
      return err(`Not enough stock for ${product.name || product.title}`);
    }

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
