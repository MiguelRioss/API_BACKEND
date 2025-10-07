// stripe/webhook.mjs
import express from "express";
import Stripe from "stripe";

// stripe/webhook.mjs
import { buildOrderPayload, normalizeLineItems /* or normalizeLineItemsWithCatalog */ } from "../utils/stripe/normalizeLineItems.mjs";

export default function stripeWebhook({ ordersService, emailService }) {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY");
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error("Missing STRIPE_WEBHOOK_SECRET");

  const router = express.Router();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
    let event;
    try {
      const sig = req.headers["stripe-signature"];
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const debug = process.env.NODE_ENV !== "production";
    if (debug) console.log("🔔 Stripe event:", { type: event.type, id: event.id, live: event.livemode });

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        // Retrieve line items
        // ...
        const { data: lineItems } = await stripe.checkout.sessions.listLineItems(session.id, {
          limit: 100,
          expand: ["data.price", "data.price.product"],
        });

        // If you want the strict version (requires metadata.productId present):
        const items = normalizeLineItems(lineItems);


        // Build order payload for your DB
        const orderPayload = buildOrderPayload({ session, items });

        // Idempotency guard
        if (ordersService.getOrderByStripeSessionId) {
          const exists = await ordersService.getOrderByStripeSessionId(session.id);
          if (exists) return res.sendStatus(200);
        }

        // Persist
        const saved = await ordersService.createOrderServices(orderPayload);
        if (debug) console.log("✅ Order created:", { id: saved?.id });

        // Delegate email to the emailService
        try {
          await emailService.sendOrderInvoiceEmail({
            order: orderPayload,
            orderId: saved?.id || session.id,
            live: event.livemode === true,
          });
          if (debug) console.log("📧 Invoice email sent");
        } catch (e) {
          console.error("📧 Email send failed:", e?.message);
          // Don’t fail the webhook on email issues
        }
      }

      return res.sendStatus(200);
    } catch (err) {
      console.error("⚠️ Webhook handler error:", err);
      return res.sendStatus(200);
    }
  });

  return router;
}
