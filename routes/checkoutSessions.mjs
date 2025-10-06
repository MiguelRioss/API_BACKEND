// routes/checkoutSessions.js
import express from "express";
import Stripe from "stripe";
import fetch from "node-fetch";

export default function checkoutRoutes({ ordersService, stockService }) {
  const router = express.Router();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  // routes/checkoutSessions.mjs
  router.post("/checkout-sessions", express.json(), async (req, res) => {
    try {
      const { items = [], clientReferenceId, customer } = req.body;
      if (!Array.isArray(items) || items.length === 0)
        return res.status(400).json({ error: "No items in payload" });

      const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
      const catalogResponse = await fetch(`${baseUrl}/api/products`);
      const catalogData = await catalogResponse.json();

      const catalog = Array.isArray(catalogData)
        ? catalogData
        : Object.values(catalogData);



      const byId = new Map(catalog.map(p => [String(p.id), p]));
      const line_items = [];

      for (const { id, qty } of items) {
        let product = byId.get(String(id));
        if (!product) throw new Error(`Product not found for id ${id}`);

        // 🔁 If the catalog entry is "light" (no price), fetch full product
        let price = Number(product.priceInEuros);
        if (!Number.isFinite(price)) {
          const detailRes = await fetch(`${baseUrl}/api/products/${id}`);
          if (!detailRes.ok) throw new Error(`Failed to load product ${id} details`);
          const full = await detailRes.json();
          price = Number(full.priceInEuros);
          if (!Number.isFinite(price)) {
            // choose ONE policy below (A, B or C):

            // A) Hard fail (strict — safest)
            throw new Error(`Invalid price for product ${id}`);

            // B) Soft default (if you want to allow checkout anyway)
            // price = 300;

            // C) Server-side price map fallback (if you have a few)
            // const FALLBACK = { 0: 300 };
            // price = Number(FALLBACK[id]);
          }
          // Use fuller object for display name if available
          product = { ...product, ...full };
        }

        const quantity = Math.max(1, Number(qty) || 1);

        // Optional guards
        if (product.soldOut) throw new Error(`${product.name || product.title} is sold out`);
        if (Number(product.stockValue) < quantity) {
          throw new Error(`Not enough stock for ${product.name || product.title}`);
        }

        const unit_amount = Math.round(price * 100);
        // in routes/checkoutSessions.mjs when building line_items
        line_items.push({
          price_data: {
            currency: "eur",
            product_data: {
              name: product.title || product.name,
              // 👇 stash your internal id on the Stripe Product
              metadata: { productId: String(product.id) }
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: Number(qty),
        });
      }


      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items,
        success_url: `${process.env.PUBLIC_BASE_URL}/#/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.PUBLIC_BASE_URL}/#/checkout/cancel`,
        client_reference_id: clientReferenceId,
        customer_email: customer?.email,
        metadata: { full_name: customer?.name || "" },
      });

      res.json({ url: session.url });
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  });


  return router;
}
