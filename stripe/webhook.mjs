// stripe/webhook.js
import express from "express";
import Stripe from "stripe";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event;
    try {
      const sig = req.headers["stripe-signature"];
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error("❌ Webhook signature verification failed.", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });

          // Example order object
          const order = {
            sessionId: session.id,
            paymentStatus: session.payment_status,
            clientReferenceId: session.client_reference_id,
            amountTotal: session.amount_total,
            currency: session.currency,
            customer: {
              name: session.customer_details?.name,
              email: session.customer_details?.email,
              phone: session.customer_details?.phone,
              address: session.customer_details?.address,
            },
            items: lineItems.data.map(li => ({
              name: li.description,
              qty: li.quantity,
              price: li.amount_total / 100,
            })),
          };

          // Create order + adjust stock
          await ordersService.create(order);
          for (const li of lineItems.data) {
            await stockService.decrement(li.description, li.quantity);
          }

          break;
        }
      }

      res.sendStatus(200);
    } catch (err) {
      console.error("⚠️ Webhook handler error:", err);
      res.sendStatus(200);
    }
  }
);

export default router;
