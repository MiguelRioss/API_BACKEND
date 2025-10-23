import { normalizeEmail, parseEmailList } from "../utils/utils.mjs";
import { buildAdminNotificationTemplate } from "../templates/adminTemplate.mjs";
import { buildAdminPendingPaymentTemplate } from "../templates/adminPendingPaymentTemplate.mjs";

/**
 * Sends an admin email (either normal or pending-payment version)
 * @param {Object} params
 * @param {Object} params.transport - The email transport instance
 * @param {Object} params.order - The order object
 * @param {String} params.orderId - The order ID
 * @param {Boolean} [params.manual=false] - Whether it's a manual order (non-Stripe)
 */
export async function sendAdminNotificationEmail({
  transport,
  order,
  orderId,
  manual = false,
}) {
  const paymentType = order.payment_type || "unknown";
  console.log("[emailService] This is their payment_type:", order.paymentType);
  const ownerEmail = normalizeEmail(process.env.ORDER_EMAIL);
  const forwardEmails = parseEmailList(process.env.ORDER_FORWARD_EMAILS || "");

  if (!ownerEmail) throw new Error("OWNER_EMAIL missing");

  const recipients = [
    { email: ownerEmail, name: "Ibogenics Admin & Logistics Team" },
    ...forwardEmails.map(email => ({ email, name: "Tech" })),
  ];

  // ⬇️ Choose template based on manual flag
  const { subject, html } = manual
    ? buildAdminPendingPaymentTemplate({
        order,
        orderId,
        orderDate: order.createdAt || order.metadata?.order_date,
      })
    : buildAdminNotificationTemplate({
        paymentType,
        order,
        orderId,
        orderDate: order.createdAt || order.metadata?.order_date,
      });

  // Send to all recipients
  for (const r of recipients) {
    await transport.send({
      toEmail: r.email,
      toName: r.name,
      subject,
      html,
    });
  }
}
