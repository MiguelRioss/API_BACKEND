// utils/stripe.mjs
// Reusable helper to create a Stripe Checkout Session and return its URL.

/**
 * Create a Stripe Checkout Session and return the public redirect URL.
 * @param {object} deps
 * @param {import('stripe').Stripe} deps.stripe - An initialized Stripe client
 * @param {Array<object>} deps.line_items - Stripe line_items (already built)
 * @param {object} [deps.customer] - { email?: string, name?: string, phone?: string, notes?: string }
 * @param {object} [deps.address] - { line1?, line2?, city?, postal_code?, country? }
 * @param {string} [deps.clientReferenceId]
 * @param {string} [deps.successUrl] - override; defaults to PUBLIC_BASE_URL
 * @param {string} [deps.cancelUrl]  - override; defaults to PUBLIC_BASE_URL
 * @param {string[]} [deps.allowedCountries] - shipping countries
 * @returns {Promise<string>} session.url
 */
// utils/stripe.mjs
export async function createUrlCheckoutSession({
  stripe,
  line_items,
  customer = {},
  address = {},
  clientReferenceId,
  successUrl = `${process.env.PUBLIC_BASE_URL}/#/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  cancelUrl  = `${process.env.PUBLIC_BASE_URL}/#/checkout/cancel`,
  // no shipping countries now (we're not collecting shipping in Checkout)
  billingSameAsShipping = false, // optional flag you set from your pre-checkout
}) {
  if (!stripe) throw new Error("Stripe client is required");
  if (!Array.isArray(line_items) || line_items.length === 0) {
    throw new Error("line_items must be a non-empty array");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items,

    // Only collect billing when absolutely required by the payment method/bank
    billing_address_collection: "auto",

    // Do NOT collect shipping in Stripe Checkout
    // shipping_address_collection: undefined,

    // Do NOT ask for phone in Checkout
    phone_number_collection: { enabled: false },

    // Let Stripe create a Customer for you (keeps history)
    customer_creation: "always",

    // Prefill email if you have it (won't force any extra forms)
    customer_email: customer?.email || undefined,

    // Optional: let Checkout auto-update Customer name/address if it ever gets collected
    customer_update: { name: "auto", address: "auto" },

    success_url: successUrl,
    cancel_url: cancelUrl,

    client_reference_id: clientReferenceId,

    // Store ONLY your pre-checkout values; Checkout won’t display these fields
    metadata: {
      full_name: customer?.name || "",
      phone: customer?.phone || "",
      notes: customer?.notes || "",
      addr_line1: address?.line1 || "",
      addr_line2: address?.line2 || "",
      addr_city: address?.city || "",
      addr_postal: address?.postal_code || "",
      addr_country: address?.country || "",
      billing_same_as_shipping: String(Boolean(billingSameAsShipping)),
    },
  });

  if (!session?.url) throw new Error("Stripe session created without URL");
  return session.url;
}


// utils/stripeLineItems.mjs

/**
 * Build Stripe Checkout `line_items` from cart items and a product lookup map.
 *
 * @param {Object} params
 * @param {{id:(string|number), qty?:number}[]} params.items - Cart items.
 * @param {Map<string, any>} params.byId - Map of productId(string) -> product object.
 * @param {string} [params.currency="eur"] - ISO currency for Stripe price_data.
 * @param {(msg:string)=>Error} [params.errorFactory] - Optional custom error creator.
 * @returns {Array<Object>} Stripe line_items
 */
export function buildStripeLineItems({
  items,
  byId,
  currency = "eur",
  errorFactory,
}) {
  const err = (msg) => (errorFactory ? errorFactory(msg) : new Error(msg));

  if (!Array.isArray(items) || items.length === 0) {
    throw err("No items in payload");
  }
  if (!(byId instanceof Map)) {
    throw err("byId must be a Map(productId -> product)");
  }

  const line_items = [];

  for (const { id, qty } of items) {
    const key = String(id);
    const product = byId.get(key);
    if (!product) throw err(`Product not found for id ${id}`);

    const price = Number(product.priceInEuros);
    if (!Number.isFinite(price) || price <= 0) {
      throw err(`Invalid price for product ${id}`);
    }

    const quantity = Math.max(1, Number(qty) || 1);

    // Stock guards (optional but recommended)
    if (product.soldOut) {
      throw err(`${product.name || product.title} is sold out`);
    }
    const stockValueNum = Number(product.stockValue);
    if (Number.isFinite(stockValueNum) && stockValueNum < quantity) {
      throw err(`Not enough stock for ${product.name || product.title}`);
    }

    const unit_amount = Math.round(price * 100); // euros -> cents

    line_items.push({
      price_data: {
        currency,
        product_data: {
          name: product.title || product.name,
          // Helpful for your webhook to reconcile order -> internal product id
          metadata: { productId: String(product.id) },
        },
        unit_amount,
      },
      quantity,
    });
  }

  return line_items;
}
