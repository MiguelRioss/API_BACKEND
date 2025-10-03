import Stripe from "stripe";
import { DEFAULT_STRIPE_API_VERSION } from "./contants/constants.js";
import { handleCheckoutSessionCompleted } from "./handlers/checkoutCompleted.js";
import { handleAsyncSessionSucceeded } from "./handlers/asyncSessionSucceeded.js";
import { handlePaymentIntentSucceeded } from "./handlers/paymentIntentSucceeded.js";

export default function createStripeWebhook({
  ordersService,
  stockService,
  stripeClient,
  webhookSecret = process.env.STRIPE_WEBHOOK_SECRET,
  logger = console,
} = {}) {
  if (!ordersService || typeof ordersService.createOrderServices !== "function") {
    throw new Error("createStripeWebhook requires an ordersService with createOrderServices");
  }

  let client = stripeClient;
  if (!client) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error("STRIPE_SECRET_KEY environment variable is not configured");
    client = new Stripe(secretKey, { apiVersion: DEFAULT_STRIPE_API_VERSION });
  }
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET environment variable is not configured");

  const stripe = client;

  return async function stripeWebhookHandler(req, res) {
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      return res.status(405).send("Method Not Allowed");
    }

    const signature = req.headers["stripe-signature"];
    if (!signature) {
      logger?.warn?.("[stripe-webhook] Missing stripe-signature header");
      return res.status(400).send("Missing stripe-signature header");
    }

    // IMPORTANT: use a raw body parser for this route
    // e.g., app.post(STRIPE_WEBHOOK_PATH, express.raw({ type: 'application/json' }), handler)
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {}));

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      logger?.error?.("[stripe-webhook] Signature verification failed", err);
      return res.status(400).send("Webhook signature verification failed");
    }

    try {
      logger?.info?.(`[stripe-webhook] Received event ${event.id} (${event.type})`);
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutSessionCompleted({ event, stripe, ordersService, stockService, logger });
          break;
        case "checkout.session.async_payment_succeeded":
          await handleAsyncSessionSucceeded({ event, stripe, ordersService, stockService, logger });
          break;
        case "payment_intent.succeeded":
          await handlePaymentIntentSucceeded({ event, stripe, ordersService, stockService, logger });
          break;
        default:
          logger?.info?.(`[stripe-webhook] Ignored event ${event.type}`);
      }
      return res.status(200).json({ received: true });
    } catch (err) {
      logger?.error?.(`[stripe-webhook] Failed to process event ${event.id} (${event.type})`, err);
      const statusCode =
        typeof err?.statusCode === "number" && err.statusCode >= 400 ? err.statusCode : 500;

      if (statusCode >= 500) return res.status(statusCode).send("Webhook handler error");
      return res.status(statusCode).json({ ok: false, error: err.message ?? "Invalid webhook payload" });
    }
  };
}
