// stripe/webhook.mjs
import express from "express";
import Stripe from "stripe";

export default function stripeWebhook({ ordersService /*, stockService */ }) {
  const router = express.Router();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Mounted at /api/stripe/webhook
  router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
    let event;
    try {
      const sig = req.headers["stripe-signature"];
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        // Expand price+product so we can read your productId metadata
        const { data: lineItems } = await stripe.checkout.sessions.listLineItems(
          session.id,
          { limit: 100, expand: ["data.price", "data.price.product"] }
        );

        // Map items to validator shape
        const items = lineItems.map((li) => {
          const qty = Number(li.quantity) || 1;
          const lineTotal = Number(li.amount_total) || 0;
          const unitAmount = Math.round(lineTotal / Math.max(qty, 1));

          // your internal id from when you created the session
          const rawId = li.price?.product?.metadata?.productId ?? li.price?.metadata?.productId;
          const internalId = Number.parseInt(rawId, 10); // 0 is allowed

          return {
            id: internalId,                                        // integer (0 allowed)
            name: li.description || li.price?.product?.name || "Unknown item",
            quantity: qty,                                         // positive integer
            unit_amount: unitAmount,                               // cents
          };
        });

        // Validate sum locally (optional; your validator also checks it)
        const sum = items.reduce((acc, it) => acc + it.quantity * it.unit_amount, 0);
        if (sum !== session.amount_total) {
          console.warn("⚠️ items sum != amount_total", { sum, amount_total: session.amount_total });
        }

        const orderPayload = {
          name: session.customer_details?.name || "",
          email: session.customer_details?.email || "",
          amount_total: session.amount_total,
          currency: (session.currency || "").toLowerCase(),
          items,
          metadata: {
            stripe_session_id: session.id,
            client_reference_id: session.client_reference_id || "",
            payment_status: session.payment_status || "",
          },
        };

        // (Optional) Idempotency: skip if already stored for this session
        if (ordersService.getOrderByStripeSessionId) {
          const exists = await ordersService.getOrderByStripeSessionId(session.id);
          if (exists) return res.sendStatus(200);
        }

        // 🔥 Persist
        const saved = await ordersService.createOrderServices(orderPayload);
        console.log("✅ Order created:", { id: saved.id, written_at: saved.written_at });
      }

      return res.sendStatus(200);
    } catch (err) {
      console.error("⚠️ Webhook handler error:", err);
      // Still 200 so Stripe doesn’t retry forever while you debug your own logic
      return res.sendStatus(200);
    }
  });

  return router;
}
