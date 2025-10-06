// routes/checkoutSessions.js
import express from "express";
import Stripe from "stripe";
import fetch from "node-fetch";

export default function checkoutRoutes() {
  const router = express.Router();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // POST /api/checkout-sessions
  router.post("/checkout-sessions", express.json(), async (req, res) => {
    const startedAt = Date.now();
    try {
      const {
        items = [],
        clientReferenceId,
        customer = {},     // { name, email, phone, notes }
        address = {},      // { line1, line2, city, postal_code, country }
      } = req.body || {};

      if (!Array.isArray(items) || items.length === 0) {
        console.warn("[checkout] empty items payload");
        return res.status(400).json({ error: "No items in payload" });
      }

      // 1) Load catalog
      const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
      console.log("[checkout] fetching catalog from:", `${baseUrl}/api/products`);
      const catalogResponse = await fetch(`${baseUrl}/api/products`);
      if (!catalogResponse.ok) throw new Error(`Catalog fetch failed (${catalogResponse.status})`);
      const catalogData = await catalogResponse.json();

      const catalog = Array.isArray(catalogData) ? catalogData : Object.values(catalogData);
      const byId = new Map(catalog.map((p) => [String(p.id), p]));

      // 2) Build Stripe line_items
      const line_items = [];
      for (const { id, qty } of items) {
        let product = byId.get(String(id));
        if (!product) throw new Error(`Product not found for id ${id}`);

        let price = Number(product.priceInEuros);
        if (!Number.isFinite(price)) {
          // fetch full product if needed
          console.log(`[checkout] loading full product ${id}`);
          const detailRes = await fetch(`${baseUrl}/api/products/${id}`);
          if (!detailRes.ok) throw new Error(`Failed to load product ${id} details`);
          const full = await detailRes.json();
          price = Number(full.priceInEuros);
          if (!Number.isFinite(price)) throw new Error(`Invalid price for product ${id}`);
          product = { ...product, ...full };
        }

        const quantity = Math.max(1, Number(qty) || 1);

        // Optional stock guards
        if (product.soldOut) throw new Error(`${product.name || product.title} is sold out`);
        if (Number(product.stockValue) < quantity) {
          throw new Error(`Not enough stock for ${product.name || product.title}`);
        }

        const unit_amount = Math.round(price * 100);
        line_items.push({
          price_data: {
            currency: "eur",
            product_data: {
              name: product.title || product.name,
              // stash your internal id for use in the webhook
              metadata: { productId: String(product.id) },
            },
            unit_amount,
          },
          quantity,
        });
      }

      // 3) Create Stripe Checkout Session
      const allowedCountries = ["AU","BR","CA","CR","DE","MX","NL","NZ","PT","ZA","UY"];

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items,

        // collect/validate by Stripe (so it’s also in session.customer_details / shipping_details)
        billing_address_collection: "required",
        shipping_address_collection: { allowed_countries: allowedCountries },
        phone_number_collection: { enabled: true },

        // create a Customer for later lookups
        customer_creation: "always",
        customer_email: customer?.email,

        success_url: `${process.env.PUBLIC_BASE_URL}/#/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.PUBLIC_BASE_URL}/#/checkout/cancel`,

        client_reference_id: clientReferenceId,

        // put your form values into metadata as a fallback/for the invoice email
        metadata: {
          full_name: customer?.name || "",
          phone: customer?.phone || "",
          notes: customer?.notes || "",
          addr_line1: address?.line1 || "",
          addr_line2: address?.line2 || "",
          addr_city: address?.city || "",
          addr_postal: address?.postal_code || "",
          addr_country: address?.country || "",
        },
      });

      console.log("[checkout] session created:", {
        id: session.id,
        urlPresent: Boolean(session.url),
        totalItems: line_items.length,
        ms: Date.now() - startedAt,
      });

      res.json({ url: session.url });
    } catch (err) {
      console.error("[checkout] error:", err?.message, { stack: err?.stack });
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
