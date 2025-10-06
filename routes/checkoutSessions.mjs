// routes/checkoutSessions.js
import express from "express";
import Stripe from "stripe";
import fetch from "node-fetch";

export default function checkoutRoutes({ ordersService, stockService }) {
  const router = express.Router();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  router.post("/checkout-sessions", express.json(), async (req, res) => {
    try {
      const { items = [], clientReferenceId, customer } = req.body;
      if (!Array.isArray(items) || items.length === 0)
        return res.status(400).json({ error: "No items in payload" });

      // Get your product catalog
      const catalog = await fetch(`${process.env.PUBLIC_BASE_URL}/api/products`).then(r => r.json());
      const byId = new Map(catalog.map(p => [String(p.id), p]));

      const line_items = [];
      for (const { id, qty } of items) {
        const product = byId.get(String(id));
        if (!product) throw new Error(`Unknown product id: ${id}`);
        if (product.soldOut) throw new Error(`${product.title} is sold out`);

        const quantity = Math.max(1, Number(qty) || 1);
        const unit_amount = Math.round(Number(product.priceInEuros) * 100);
        line_items.push({
          price_data: {
            currency: "eur",
            product_data: { name: product.title },
            unit_amount,
          },
          quantity,
        });
      }

      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          line_items,
          success_url: `${process.env.PUBLIC_BASE_URL}/#/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.PUBLIC_BASE_URL}/#/checkout/cancel`,
          client_reference_id: clientReferenceId,
          customer_email: customer?.email,
          customer_creation: "always",
          metadata: {
            full_name: customer?.name || "",
            phone: customer?.phone || "",
            notes: customer?.notes || "",
          },
        },
        { idempotencyKey: `checkout_${clientReferenceId || Date.now()}` }
      );

      res.json({ url: session.url });
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
