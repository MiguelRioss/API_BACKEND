// api/emailAPI.mjs
import handlerFactory from "../utils/handleFactory.mjs";

export default function createEmailAPI(emailService) {
  const hasContact = emailService && typeof emailService.sendContactEmail === "function";
  const hasOrderEmails = emailService && typeof emailService.sendOrderEmails === "function";
  const hasShipping = emailService && typeof emailService.sendShippingEmail === "function";

  if (!hasContact || !hasOrderEmails || !hasShipping) {
    throw "API dependency invalid";
  }

  return {
    handleContactForm: handlerFactory(internalHandleContactForm),
    handleInvoiceEmail: handlerFactory(internalHandleInvoiceEmail),
    handleShippingEmail: handlerFactory(internalHandleShippingEmail),
  };

  async function internalHandleContactForm(req, res) {
    const { name, email, subject, message, orderId, country } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await emailService.sendContactEmail({
      name,
      email,
      subject,
      message,
      orderId,
      country,
    });

    return res.status(200).json({
      description: "Message Sent",
      uri: "/api/contactUs",
    });
  }

  async function internalHandleInvoiceEmail(req, res) {
    const { order, orderId, logoPath, live } = req.body || {};

    if (!order || typeof order !== "object") {
      return res.status(400).json({ error: "Missing order payload" });
    }

    const resolvedOrderId = orderId || order?.id;
    if (!resolvedOrderId) {
      return res.status(400).json({ error: "Order id is required" });
    }

    const normalizedLive =
      typeof live === "string" ? live.toLowerCase() === "true" : Boolean(live);

    await emailService.sendOrderEmails({
      order,
      orderId: resolvedOrderId,
      logoPath,
      live: normalizedLive,
    });

    return res.status(200).json({
      description: "Invoice email sent",
      orderId: resolvedOrderId,
      uri: "/api/email/invoice",
    });
  }

  async function internalHandleShippingEmail(req, res) {
    const {
      order,
      orderId,
      orderDate,
      invoiceId,
      trackingNumber,
      trackingUrl,
      locale,
      live,
    } = req.body || {};

    if (!order || typeof order !== "object") {
      return res.status(400).json({ error: "Missing order payload" });
    }

    const resolvedOrderId = orderId || order?.id;
    if (!resolvedOrderId) {
      return res.status(400).json({ error: "Order id is required" });
    }

    const normalizedLive =
      typeof live === "string" ? live.toLowerCase() === "true" : Boolean(live);

    await emailService.sendShippingEmail({
      order,
      orderId: resolvedOrderId,
      orderDate,
      invoiceId,
      trackingNumber,
      trackingUrl,
      locale,
      live: normalizedLive,
    });

    return res.status(200).json({
      description: "Shipping email sent",
      orderId: resolvedOrderId,
      uri: "/api/email/shipping",
    });
  }
}
