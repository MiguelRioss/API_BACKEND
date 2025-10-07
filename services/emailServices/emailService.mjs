// services/emailService.mjs
import { buildOrderInvoiceHtml } from "./emailTemplates.mjs";

/**
 * High-level email service that builds + sends order invoices.
 * @param {object} deps
 * @param {{send:Function}} deps.transport - e.g., brevoTransport
 */
export default function createEmailService({ transport }) {
  return { sendOrderInvoiceEmail };

  /**
   * Sends invoice to the buyer (or TEST_RECIPIENT in test mode), BCCs OWNER_EMAIL.
   * @param {object} params
   * @param {object} params.order - order payload from webhook
   * @param {string|number} [params.orderId] - internal order id to show
   * @param {boolean} [params.live=false] - Stripe live mode flag
   */
  async function sendOrderInvoiceEmail({ order, orderId, live = false }) {
    const isTestRoute = !live && !!process.env.TEST_RECIPIENT;

    const toEmail = isTestRoute ? process.env.TEST_RECIPIENT : order?.email;
    const toName = isTestRoute ? "Test Recipient" : (order?.name || "");
    if (!toEmail) return; // gracefully skip if no recipient

    const html = buildOrderInvoiceHtml({ order, orderId });
    const subject = `Your Order ${orderId || ""}`.trim();

    await transport.send({
      toEmail,
      toName,
      subject,
      html,
      bcc: process.env.OWNER_EMAIL || undefined,
    });
  }
}
