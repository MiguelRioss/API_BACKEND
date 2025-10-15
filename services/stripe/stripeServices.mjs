// services/stripeServices.mjs
import Stripe from "stripe";
import errors from "../../errors/errors.mjs";
import { createUrlCheckoutSession, buildStripeLineItems } from "./stripeUtils.mjs";

export default function createStripeServices(stockServices) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

  return { createCheckoutSession };

  async function createCheckoutSession({
    items = [],
    clientReferenceId,
    customer = {},
    shippingAddress = {},
    billingAddress = {},
    billingSameAsShipping = false,
    shippingCostCents = null,
    notes,
  }) {
    if (!Array.isArray(items) || items.length === 0) {
      return Promise.reject(errors.invalidData("No items in payload"));
    }

    const catalog = await stockServices.getAllProducts();
    if (!Array.isArray(catalog)) {
      if (catalog && typeof catalog === "object" && catalog.httpStatus) {
        return Promise.reject(catalog);
      }
      return Promise.reject(errors.internalError("Catalog fetch failed (not an array)"));
    }

    if (!stripe) {
      return Promise.reject(errors.forbidden("STRIPE_SECRET_KEY missing"));
    }

    const byId = new Map(catalog.map((product) => [String(product.id), product]));
    const normalizedShippingCents = (() => {
      const num = Number(shippingCostCents);
      if (!Number.isFinite(num)) return 0;
      const int = Math.trunc(num);
      return int > 0 ? int : 0;
    })();

    const line_items = buildStripeLineItems({
      items,
      byId,
      currency: "eur",
      errorFactory: (msg) => errors.badRequest(msg),
    });

    if (!Array.isArray(line_items)) {
      return Promise.reject(line_items);
    }

    if (normalizedShippingCents > 0) {
      line_items.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: "Shipping",
            metadata: {
              productId: "__shipping__",
            },
          },
          unit_amount: normalizedShippingCents,
        },
        quantity: 1,
      });
    }

    const sessionResult = await createUrlCheckoutSession({
      stripe,
      line_items,
      customer,
      shippingAddress,
      billingAddress,
      billingSameAsShipping,
      shippingCostCents: normalizedShippingCents,
      clientReferenceId,
      notes,
    });

    if (
      !sessionResult ||
      typeof sessionResult !== "object" ||
      typeof sessionResult.url !== "string"
    ) {
      return Promise.reject(sessionResult);
    }

    return {
      url: sessionResult.url,
      sessionId: sessionResult.sessionId,
      paymentIntentId: sessionResult.paymentIntentId,
    };
  }
}
