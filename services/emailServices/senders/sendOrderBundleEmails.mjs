import { sendThankYouEmail } from "./sendThankYouEmail.mjs";
import { sendAdminNotificationEmail } from "./sendAdminNotificationEmail.mjs";

/**
 * Sends both customer Thank You + Admin notification using the same order info.
 */
export async function sendOrderBundleEmails({ transport, order, orderId, logoPath }) {
  // 1. Send the customer thank-you with invoice PDF
  await sendThankYouEmail({ transport, order, orderId, logoPath });

  // 2. Send the admin notification (no need to re-generate PDF)
  await sendAdminNotificationEmail({ transport, order, orderId });
}
