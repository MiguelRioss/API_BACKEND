// stripe/webhook.mjs
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
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (debug) console.log("🔔 Stripe event:", { type: event.type, id: event.id, live: event.livemode });

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        // 1) Fetch line items with expansions so metadata/product name are available
        const { data: lineItems } = await stripe.checkout.sessions.listLineItems(session.id, {
          limit: 100,
          expand: ["data.price", "data.price.product"],
        });

        if (debug) {
          console.log("🛒 Line item meta preview:");
          console.dir(
            lineItems.map(li => ({
              li: li.id,
              desc: li.description,
              priceId: li.price?.id,
              prodId: li.price?.product?.id,
              prodMeta: li.price?.product?.metadata,
              priceMeta: li.price?.metadata,
            })),
            { depth: null }
          );
        }

        // 2) Strict normalization first (requires productId metadata)
        let items = normalizeLineItems(lineItems);

        // 3) If any item.id is missing/invalid, try name-based fallback with local catalog
        const anyMissing = items.some(it =>
          it.id === "" || it.id === "undefined" || Number.isNaN(it.id)
        );
        if (anyMissing) {
          if (debug) console.log("ℹ️ Missing productId metadata; attempting catalog fallback…");
          try {
            // stockService should expose your local catalog
            const catalog = await stockService.getAllProducts();
            items = normalizeLineItemsWithCatalog(lineItems, catalog);
          } catch (e) {
            console.warn("⚠️ Could not load catalog for fallback:", e?.message || e);
          }
        }

        // 4) Build order payload for your DB
        const orderPayload = buildOrderPayload({ session, items });

        // 5) Idempotency guard
        if (ordersService.getOrderByStripeSessionId) {
          const exists = await ordersService.getOrderByStripeSessionId(session.id);
          if (exists) return res.sendStatus(200);
        }

        // 6) Persist
        const saved = await ordersService.createOrderServices(orderPayload);
        if (debug) console.log("✅ Order created:", { id: saved?.id });

        // 7) Email (don’t fail webhook on email errors)
        try {
          // Build invoice HTML
          const invoiceHtml = buildOrderInvoiceHtml({
            order: orderPayload,
            orderId: saved?.id || session.id,
          });

          // Create PDF invoice file
          const pdfPath = await createPdfInvoice(invoiceHtml, "./assets/logo/ibogenics_logo_cropped.png");

          // Build short thank-you email HTML
          const thankYouHtml = buildThankYouEmailHtml({ order: orderPayload });

          // Send email with PDF attachment
          await emailService.send({
            to: orderPayload.email,
            subject: "Thank you for your order – Ibogenics",
            html: thankYouHtml,
            attachments: [
              {
                filename: `Invoice-${saved?.id || session.id}.pdf`,
                path: pdfPath,
                contentType: "application/pdf",
              },
            ],
          });

          if (debug) console.log("📧 Invoice email sent with PDF attachment");
        } catch (e) {
          console.error("📧 Email send failed:", e?.message);
        }

      }

      return res.sendStatus(200);
    } catch (err) {
      console.error("⚠️ Webhook handler error:", err);
      return res.sendStatus(200); // switch to 500 if you want Stripe to retry on failures
    }
  });

  return router;
}
