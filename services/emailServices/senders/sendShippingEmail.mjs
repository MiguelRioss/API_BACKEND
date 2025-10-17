import errors from "../../../errors/errors.mjs";
import { buildShippingNotificationTemplate } from "../templates/shippingTemplate.mjs";

/**
 * Sends a shipping notification email with tracking info.
 * @param {Object} params
 * @param {Object} params.transport - Email transport instance
 * @param {Object} params.order - Order object
 * @param {String} params.orderId - Order ID
 * @param {String} [params.orderDate]
 * @param {String} [params.invoiceId]
 * @param {String} [params.trackingNumber]
 * @param {String} [params.trackingUrl]
 * @param {String} [params.locale]
 */
export async function sendShippingEmail({
  transport,
  order,
  orderId,
  orderDate,
  invoiceId,
  trackingNumber,
  trackingUrl,
  locale,
} = {}) {
  if (!order || typeof order !== "object") {
    return Promise.reject(errors.invalidData("sendShippingEmail requires an order object"));
  }

  // Default to test recipient if no real one
  const toEmail = order.email || process.env.TEST_RECIPIENT;
  const toName = order.name || "Customer";

  if (!toEmail) {
    return Promise.reject(errors.invalidData("No valid email address for shipping notification."));
  }

  const { subject, html } = buildShippingNotificationTemplate({
    order,
    orderId,
    orderDate,
    invoiceId,
    trackingNumber,
    trackingUrl,
    locale,
  });

  try {
    await transport.send({
      toEmail,
      toName,
      subject,
      html,
    });
    console.log(`[emailService] Shipping email sent to ${toEmail}`);
  } catch (err) {
    console.error("[emailService] Failed to send shipping email:", err?.message || err);
    throw err;
  }
}
