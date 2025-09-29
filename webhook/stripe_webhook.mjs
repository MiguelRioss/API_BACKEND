import Stripe from "stripe";

const DEFAULT_STRIPE_API_VERSION = "2023-10-16";
export const STRIPE_WEBHOOK_PATH = "/webhook/stripe";

function createHttpError(statusCode, message, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) {
    error.details = details;
  }
  return error;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toSafeString(value) {
  if (typeof value === "string") return value.trim();
  if (value === null || typeof value === "undefined") return "";
  return String(value).trim();
}

function ensureNonEmpty(value, message) {
  const str = toSafeString(value);
  if (!str) {
    throw createHttpError(400, message);
  }
  return str;
}

function buildItems(lineItems) {
  const items = lineItems.map((line, index) => {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw createHttpError(400, `Invalid quantity for line item at position ${index}`);
    }

    if (!Number.isInteger(line.amount_total) || line.amount_total < 0) {
      throw createHttpError(400, `Invalid amount_total for line item at position ${index}`);
    }

    const quantity = line.quantity;
    const lineTotal = line.amount_total;

    let unitAmount;
    if (lineTotal % quantity === 0) {
      unitAmount = lineTotal / quantity;
    } else if (line.price && Number.isInteger(line.price.unit_amount)) {
      unitAmount = line.price.unit_amount;
    } else {
      throw createHttpError(
        400,
        `Unable to derive unit_amount for line item at position ${index}`
      );
    }

    if (!Number.isInteger(unitAmount) || unitAmount < 0) {
      throw createHttpError(400, `Invalid unit amount for line item at position ${index}`);
    }

    const id = ensureNonEmpty(
      line.price?.product ?? line.price?.id ?? line.id,
      `Missing id for line item at position ${index}`
    );
    const name = ensureNonEmpty(
      line.description ?? line.price?.nickname ?? line.price?.product ?? line.id,
      `Missing name for line item at position ${index}`
    );

    return {
      id,
      name,
      quantity,
      unit_amount: unitAmount,
    };
  });

  const amount_total = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_amount,
    0
  );

  return { items, amount_total };
}

function buildMetadata(session, defaults) {
  const metadata = {};

  if (isPlainObject(session.metadata)) {
    for (const [key, value] of Object.entries(session.metadata)) {
      metadata[key] = value;
    }
  }

  const shipping = session.shipping_details ?? {};
  const shippingAddress = shipping.address ?? {};
  const customer = session.customer_details ?? {};
  const customerAddress = customer.address ?? {};

  metadata.addr_line1 = toSafeString(
    shippingAddress.line1 ?? customerAddress.line1 ?? metadata.addr_line1
  );
  metadata.addr_line2 = toSafeString(
    shippingAddress.line2 ?? customerAddress.line2 ?? metadata.addr_line2
  );
  metadata.addr_city = toSafeString(
    shippingAddress.city ?? customerAddress.city ?? metadata.addr_city
  );
  metadata.addr_ctry = toSafeString(
    shippingAddress.country ?? customerAddress.country ?? metadata.addr_ctry
  );
  metadata.addr_zip = toSafeString(
    shippingAddress.postal_code ?? customerAddress.postal_code ?? metadata.addr_zip
  );
  metadata.full_name = toSafeString(shipping.name ?? customer.name ?? defaults.name);
  metadata.phone = toSafeString(shipping.phone ?? customer.phone ?? metadata.phone);
  metadata.stripe_session_id = toSafeString(session.id);
  metadata.payment_intent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : toSafeString(session.payment_intent?.id);
  metadata.customer_id = toSafeString(session.customer);
  metadata.client_reference_id = toSafeString(session.client_reference_id);
  metadata.checkout_status = toSafeString(session.status);
  metadata.checkout_mode = toSafeString(session.mode);

  return metadata;
}

function buildOrderPayload(session, lineItems) {
  const name = ensureNonEmpty(
    session.shipping_details?.name ??
      session.customer_details?.name ??
      session.metadata?.full_name,
    "Missing customer name in checkout session"
  );

  const email = ensureNonEmpty(
    session.customer_details?.email ?? session.customer_email,
    "Missing customer email in checkout session"
  );

  const currency = ensureNonEmpty(
    session.currency,
    "Missing currency in checkout session"
  ).toLowerCase();

  const { items, amount_total } = buildItems(lineItems);

  if (items.length === 0) {
    throw createHttpError(400, "Checkout session has no purchasable items");
  }

  const metadata = buildMetadata(session, { name, email });

  const orderPayload = {
    name,
    email,
    currency,
    amount_total,
    items,
    metadata,
    session_id: session.id,
    payment_status: session.payment_status,
  };

  if (session.payment_intent) {
    orderPayload.payment_intent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
  }

  if (session.customer) {
    orderPayload.customer = session.customer;
  }

  if (session.client_reference_id) {
    orderPayload.client_reference_id = session.client_reference_id;
  }

  return orderPayload;
}

async function findExistingOrder(ordersService, { sessionId, paymentIntentId }) {
  try {
    const orders = await ordersService.getOrdersServices();
    return orders.find(
      (o) =>
        (sessionId && o?.session_id === sessionId) ||
        (paymentIntentId && o?.payment_intent === paymentIntentId)
    );
  } catch (e) {
    return null; // fail open; webhook should still try to create
  }
}

async function handleCheckoutSessionCompleted({ event, stripe, ordersService, stockService, logger }) {
  const session = event.data?.object;
  if (!session?.id) {
    throw createHttpError(400, "Checkout session payload missing id");
  }

  const lineItemsResponse = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ["data.price"],
  });

  const lineItems = Array.isArray(lineItemsResponse?.data) ? lineItemsResponse.data : [];

  if (lineItems.length === 0) {
    throw createHttpError(400, `No line items found for checkout session ${session.id}`);
  }

  const existing = await findExistingOrder(ordersService, {
    sessionId: session.id,
    paymentIntentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id,
  });
  if (existing) {
    logger?.info?.(
      `[stripe-webhook] Duplicate suppressed for session ${session.id} (existing order ${existing.id})`
    );
    return; // idempotent
  }

  const orderPayload = buildOrderPayload(session, lineItems);
  await ordersService.createOrderServices(orderPayload);

  logger?.info?.(`[stripe-webhook] Created order for session ${session.id}`);
  // Decrement stock per line item (best effort)
  try {
    if (stockService && typeof stockService.decrementStock === "function") {
      await Promise.allSettled(
        lineItems.map((l) => stockService.decrementStock(l.price?.product ?? l.price?.id ?? l.id, l.quantity))
      );
    }
  } catch (e) {
    logger?.warn?.(`[stripe-webhook] Stock decrement failed for session ${session.id}: ${e?.message ?? e}`);
  }
}

async function handleAsyncSessionSucceeded({ event, stripe, ordersService, stockService, logger }) {
  // Some payment methods complete asynchronously. Stripe emits
  // `checkout.session.async_payment_succeeded` instead of `completed`.
  const session = event.data?.object;
  if (!session?.id) {
    throw createHttpError(400, "Async checkout session payload missing id");
  }

  const lineItemsResponse = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ["data.price"],
  });
  const lineItems = Array.isArray(lineItemsResponse?.data) ? lineItemsResponse.data : [];
  if (lineItems.length === 0) {
    throw createHttpError(400, `No line items found for checkout session ${session.id}`);
  }

  const existing = await findExistingOrder(ordersService, {
    sessionId: session.id,
    paymentIntentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id,
  });
  if (existing) {
    logger?.info?.(
      `[stripe-webhook] Duplicate suppressed for async session ${session.id} (existing order ${existing.id})`
    );
    return;
  }

  const orderPayload = buildOrderPayload(session, lineItems);
  await ordersService.createOrderServices(orderPayload);
  logger?.info?.(`[stripe-webhook] Created order for async session ${session.id}`);
  try {
    if (stockService && typeof stockService.decrementStock === "function") {
      await Promise.allSettled(
        lineItems.map((l) => stockService.decrementStock(l.price?.product ?? l.price?.id ?? l.id, l.quantity))
      );
    }
  } catch (e) {
    logger?.warn?.(`[stripe-webhook] Stock decrement failed for async session ${session.id}: ${e?.message ?? e}`);
  }
}

async function handlePaymentIntentSucceeded({ event, stripe, ordersService, stockService, logger }) {
  // If the integration used Payment Element or PI API directly, we won't get
  // a checkout.session.completed event. Try to locate a related Checkout
  // Session via the payment_intent and reuse the same path.
  const pi = event.data?.object;
  const paymentIntentId = typeof pi?.id === "string" ? pi.id : undefined;
  if (!paymentIntentId) {
    throw createHttpError(400, "payment_intent.succeeded missing id");
  }

  // Try to find a Checkout Session associated with this PI
  const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 });
  const session = Array.isArray(sessions?.data) ? sessions.data[0] : undefined;
  if (!session) {
    // No Checkout Session found; nothing we can do to derive line items reliably
    logger?.info?.(
      `[stripe-webhook] payment_intent.succeeded (${paymentIntentId}) without Checkout Session — skipping order creation`
    );
    return;
  }

  const lineItemsResponse = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ["data.price"],
  });
  const lineItems = Array.isArray(lineItemsResponse?.data) ? lineItemsResponse.data : [];
  if (lineItems.length === 0) {
    throw createHttpError(400, `No line items found for checkout session ${session.id}`);
  }

  const existing = await findExistingOrder(ordersService, {
    sessionId: session.id,
    paymentIntentId: paymentIntentId,
  });
  if (existing) {
    logger?.info?.(
      `[stripe-webhook] Duplicate suppressed for payment_intent ${paymentIntentId} (existing order ${existing.id})`
    );
    return;
  }

  const orderPayload = buildOrderPayload(session, lineItems);
  await ordersService.createOrderServices(orderPayload);
  logger?.info?.(
    `[stripe-webhook] Created order via payment_intent.succeeded for session ${session.id}`
  );
  try {
    if (stockService && typeof stockService.decrementStock === "function") {
      await Promise.allSettled(
        lineItems.map((l) => stockService.decrementStock(l.price?.product ?? l.price?.id ?? l.id, l.quantity))
      );
    }
  } catch (e) {
    logger?.warn?.(
      `[stripe-webhook] Stock decrement failed for PI ${paymentIntentId}: ${e?.message ?? e}`
    );
  }
}

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
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not configured");
    }
    client = new Stripe(secretKey, { apiVersion: DEFAULT_STRIPE_API_VERSION });
  }

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET environment variable is not configured");
  }

  const stripe = client;

  // stock decrement is handled inside event-specific handlers right after order creation

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

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(
          typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {})
        );

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
      logger?.error?.(
        `[stripe-webhook] Failed to process event ${event.id} (${event.type})`,
        err
      );
      const statusCode =
        typeof err?.statusCode === "number" && err.statusCode >= 400
          ? err.statusCode
          : 500;

      if (statusCode >= 500) {
        return res.status(statusCode).send("Webhook handler error");
      }

      return res
        .status(statusCode)
        .json({ ok: false, error: err.message ?? "Invalid webhook payload" });
    }
  };
}
