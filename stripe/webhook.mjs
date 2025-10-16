import express from "express";
import Stripe from "stripe";
import errors from "../../errors/errors.mjs";
import handlerFactory from "../utils/handleFactory.mjs"
import {
  normalizeLineItems,
  normalizeLineItemsWithCatalog,
  buildOrderPayload,
} from "./webHookutils.mjs";

// Use your unified handler utilities
const { isAppError, sendError } = handlerFactory;

export default function stripeWebhook({ ordersService, stockService }) {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY");
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  if (!ordersService || typeof ordersService.createOrderServices !== "function") {
    throw errors.internalError("stripeWebhook requires ordersService.createOrderServices()");
  }

  const router = express.Router();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const debug = process.env.NODE_ENV !== "production";

  router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
    let event;
    try {
      const sig = req.headers["stripe-signature"];
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error("[stripeWebhook] Signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (debug) {
      console.log("[stripeWebhook] Event received:", {
        type: event.type,
        id: event.id,
        live: event.livemode,
      });
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        // 1️⃣ Fetch line items
        const { data: lineItems } = await stripe.checkout.sessions.listLineItems(session.id, {
          limit: 100,
          expand: ["data.price", "data.price.product"],
        });

        if (debug) {
          console.log(
            "[stripeWebhook] Line item preview:",
            lineItems.map((li) => ({
              id: li.id,
              description: li.description,
              priceId: li.price?.id,
              productId: li.price?.product?.id,
              productMeta: li.price?.product?.metadata,
              priceMeta: li.price?.metadata,
            }))
          );
        }

        // 2️⃣ Normalize
        let items = normalizeLineItems(lineItems);

        // 3️⃣ Fallback if product IDs are missing
        const anyMissing = items.some((it) => !Number.isInteger(it.id));
        if (anyMissing) {
          if (debug) console.log("[stripeWebhook] Missing productId metadata; attempting catalog fallback.");
          try {
            const catalog = await stockService.getAllProducts();
            items = normalizeLineItemsWithCatalog(lineItems, catalog);
          } catch (e) {
            console.warn("[stripeWebhook] Could not load catalog for fallback:", e?.message || e);
          }
        }

        if (items.some((it) => !Number.isInteger(it.id))) {
          throw errors.externalService("Could not resolve product IDs for line items");
        }

        // 4️⃣ Build order payload
        const orderPayload = buildOrderPayload({ session, items });

        // 5️⃣ Idempotency check
        if (ordersService.getOrderByStripeSessionId) {
          let exists = null;
          try {
            exists = await ordersService.getOrderByStripeSessionId(session.id);
          } catch (lookupErr) {
            const isNotFound =
              lookupErr?.code === "NOT_FOUND" || lookupErr?.httpStatus === 404;
            if (!isNotFound) throw lookupErr;
          }
          if (exists) {
            if (debug) console.log("[stripeWebhook] Order already processed, skipping.");
            return res.sendStatus(200);
          }
        }

        // 6️⃣ Persist
        const saved = await ordersService.createOrderServices(orderPayload);
        if (debug) console.log("[stripeWebhook] Order persisted:", { id: saved?.id });
      }

      // ✅ Always acknowledge receipt to Stripe when processing succeeded
      return res.sendStatus(200);
    } catch (err) {
      console.error("[stripeWebhook] Handler error:", err);

      // Known AppError (from errors.mjs)
      if (isAppError && isAppError(err)) {
        // 4xx → non-retryable
        if (err.httpStatus >= 400 && err.httpStatus < 500) {
          if (debug) sendError(res, err); // show JSON when debugging
          else return res.sendStatus(200);
        }
        // 5xx → retryable
        else {
          if (debug) sendError(res, err);
          else return res.sendStatus(500);
        }
        return;
      }

      // Unknown / unexpected error
      console.error("[stripeWebhook] Unexpected error type:", err);
      if (debug) {
        return sendError(res, errors.internalError("Unexpected error in webhook", { reason: err.message }));
      }

      // Return 500 so Stripe retries
      return res.sendStatus(500);
    }
  });

  return router;
}
