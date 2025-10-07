import express from "express";
import Stripe from "stripe";

import {
  normalizeLineItems,
  normalizeLineItemsWithCatalog,
  buildOrderPayload,
} from "./webHookutils.mjs";

// Inject stockService so we can do catalog fallback locally
export default function stripeWebhook({ ordersService, emailService, stockService }) {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY");
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  if (!ordersService || typeof ordersService.createOrderServices !== "function") {
    throw new Error("stripeWebhook requires ordersService.createOrderServices()");
  }
  if (!emailService || typeof emailService.sendOrderInvoiceEmail !== "function") {
    throw new Error("stripeWebhook requires emailService.sendOrderInvoiceEmail()");
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

        // 1) Fetch line items with expansions so metadata/product name are available
        const { data: lineItems } = await stripe.checkout.sessions.listLineItems(session.id, {
          limit: 100,
          expand: ["data.price", "data.price.product"],
        });

        if (debug) {
          console.log("[stripeWebhook] Line item preview:", lineItems.map((li) => ({
            id: li.id,
            description: li.description,
            priceId: li.price?.id,
            productId: li.price?.product?.id,
            productMeta: li.price?.product?.metadata,
            priceMeta: li.price?.metadata,
          })));
        }

        // 2) Strict normalization first (requires productId metadata)
        let items = normalizeLineItems(lineItems);

        // 3) If any item.id is missing/invalid, try name-based fallback with local catalog
        const anyMissing = items.some(
          (it) => it.id === "" || it.id === "undefined" || Number.isNaN(it.id)
        );
        if (anyMissing) {
          if (debug) console.log("[stripeWebhook] Missing productId metadata; attempting catalog fallback.");
          try {
            const catalog = await stockService.getAllProducts();
            items = normalizeLineItemsWithCatalog(lineItems, catalog);
          } catch (e) {
            console.warn("[stripeWebhook] Could not load catalog for fallback:", e?.message || e);
          }
        }

        // 4) Build order payload for your DB
        const orderPayload = buildOrderPayload({ session, items });

        // 5) Idempotency guard
        if (ordersService.getOrderByStripeSessionId) {
          const exists = await ordersService.getOrderByStripeSessionId(session.id);
          if (exists) {
            if (debug) console.log("[stripeWebhook] Order already processed, skipping.");
            return res.sendStatus(200);
          }
        }

        // 6) Persist
        const saved = await ordersService.createOrderServices(orderPayload);
        if (debug) console.log("[stripeWebhook] Order persisted:", { id: saved?.id });

        // 7) Email (don't fail webhook on email errors)
        try {
          await emailService.sendOrderInvoiceEmail({
            order: orderPayload,
            orderId: saved?.id || session.id,
            live: event.livemode,
          });
          if (debug) console.log("[stripeWebhook] Invoice email sent via Brevo.");
        } catch (e) {
          console.error("[stripeWebhook] Email send failed:", e?.message || e);
        }
      }

      return res.sendStatus(200);
    } catch (err) {
      console.error("[stripeWebhook] Handler error:", err);
      // Stripe should retry on 500s. Return 200 if you want to swallow the error instead.
      return res.sendStatus(200);
    }
  });

  return router;
}
