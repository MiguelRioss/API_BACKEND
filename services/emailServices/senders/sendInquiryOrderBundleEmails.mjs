import { sendOtherCountryEmail } from "./sendOtherCountryEmail.mjs";
import { sendAdminNotificationEmail } from "./sendAdminNotificationEmail.mjs";

/**
 * sendInquiryOrderBundleEmails
 * ----------------------------
 * Sends both:
 *  - "Other Country" customer email (manual order confirmation)
 *  - "Admin Notification" email (internal alert)
 *
 * Used when an order is requested from a country
 * outside Stripe-supported regions.
 */
export async function sendInquiryOrderBundleEmails({
  order,
  orderId,
  manual = true,
  transport,
}) {
  if (!transport || typeof transport.send !== "function") {
    throw new Error("sendInquiryOrderBundleEmails requires a valid transport");
  }

  await Promise.all([
    sendOtherCountryEmail({ transport, order, orderId }),
    sendAdminNotificationEmail({ transport, order, orderId, manual }),
  ]);

  console.log("[emailService] Inquiry Order Bundle sent for order:", orderId);
}
