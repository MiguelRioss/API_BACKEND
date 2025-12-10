// api/email/senders/sendSampleOrderBundleEmails.mjs
import { sendSamplesEmailTemplateClient } from "./sendSampleOrderEmailClient.mjs";
import { sendSamplesEmailTemplateAdmin } from "./sendSampleOrderEmailAdmin.mjs";

/**
 * Sends both:
 *  - client samples email
 *  - admin samples notification email
 */
export async function sendSampleOrderBundleEmails({
  transport,
  order,
  orderId,
  live = true,
} = {}) {
  // 1. Client email
  await sendSamplesEmailTemplateClient({
    transport,
    order,
    orderId,
    live,
  });

  // 2. Admin email
  await sendSamplesEmailTemplateAdmin({
    transport,
    order,
    orderId,
    live,
  });
}
