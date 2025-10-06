import express from "express";
import Stripe from "stripe";
import { sendInvoiceEmail } from "../services/emailService.mjs";

export default function stripeWebhook({ ordersService }) {
  const router = express.Router();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // IMPORTANT: raw body here (do not use express.json() on this route)
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

        const { data: lineItems } = await stripe.checkout.sessions.listLineItems(
          session.id,
          { limit: 100, expand: ["data.price", "data.price.product"] }
        );

        const items = lineItems.map((li) => {
          const qty = Number(li.quantity) || 1;
          const lineTotal = Number(li.amount_total) || 0;
          const unitAmount = Math.round(lineTotal / Math.max(qty, 1));
          const rawId = li.price?.product?.metadata?.productId ?? li.price?.metadata?.productId;
          const internalId = Number.parseInt(rawId, 10);
          return { id: internalId, name: li.description || li.price?.product?.name || "Item", quantity: qty, unit_amount: unitAmount };
        });

        const orderPayload = {
          name: session.customer_details?.name || session.metadata?.full_name || "",
          email: session.customer_details?.email || "",
          amount_total: session.amount_total,
          currency: (session.currency || "").toLowerCase(),
          items,
          metadata: {
            stripe_session_id: session.id,
            client_reference_id: session.client_reference_id || "",
            payment_status: session.payment_status || "",
            phone: session.customer_details?.phone || session.metadata?.phone || "",
            notes: session.metadata?.notes || "",
            address: {
              line1: session.shipping_details?.address?.line1 || session.customer_details?.address?.line1 || session.metadata?.addr_line1 || "",
              line2: session.shipping_details?.address?.line2 || session.customer_details?.address?.line2 || session.metadata?.addr_line2 || "",
              city: session.shipping_details?.address?.city || session.customer_details?.address?.city || session.metadata?.addr_city || "",
              postal_code: session.shipping_details?.address?.postal_code || session.customer_details?.address?.postal_code || session.metadata?.addr_postal || "",
              country: session.shipping_details?.address?.country || session.customer_details?.address?.country || session.metadata?.addr_country || "",
            },
          },
        };

        // Idempotency (optional)
        if (ordersService.getOrderByStripeSessionId) {
          const exists = await ordersService.getOrderByStripeSessionId(session.id);
          if (exists) return res.sendStatus(200);
        }

        // Persist
        const saved = await ordersService.createOrderServices(orderPayload);
        console.log("✅ Order created:", { id: saved.id });

        // Build invoice HTML
        const a = orderPayload.metadata.address || {};
        const addrHtml = [a.line1, a.line2, `${a.postal_code || ""} ${a.city || ""}`.trim(), a.country]
          .filter(Boolean).join("<br/>");
        const money = (c) => `${(c/100).toFixed(2)} ${orderPayload.currency.toUpperCase()}`;

        const html = `
          <h2>Thank you for your order</h2>
          <p><b>Order:</b> ${saved.id || session.id}</p>
          <p><b>Name:</b> ${orderPayload.name || "-"}<br/>
             <b>Email:</b> ${orderPayload.email || "-"}<br/>
             <b>Phone:</b> ${orderPayload.metadata.phone || "-"}</p>
          ${addrHtml ? `<p><b>Address:</b><br/>${addrHtml}</p>` : ""}
          ${orderPayload.metadata.notes ? `<p><b>Notes:</b> ${orderPayload.metadata.notes}</p>` : ""}
          <hr/>
          <ul>
            ${orderPayload.items.map(it => `<li>${it.quantity} × ${it.name} — ${money(it.unit_amount)}</li>`).join("")}
          </ul>
          <p style="margin-top:8px"><b>Total:</b> ${money(orderPayload.amount_total)}</p>
        `;

        // Route emails safely in test mode
        const isTest = event.livemode === false;
        let toEmail = orderPayload.email;
        let toName  = orderPayload.name;
        if (isTest && process.env.TEST_RECIPIENT) {
          toEmail = process.env.TEST_RECIPIENT;
          toName  = "Test Recipient";
        }

        try {
          await sendInvoiceEmail({
            toEmail,
            toName,
            ownerEmail: process.env.OWNER_EMAIL, // BCC copy to you
            html,
          });
          console.log("📧 Invoice email sent to", toEmail);
        } catch (e) {
          console.error("📧 Email send failed:", e?.message);
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
