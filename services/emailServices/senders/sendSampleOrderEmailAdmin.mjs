// api/email/senders/sendSamplesEmailTemplateAdmin.mjs
import { parseEmailList } from "../utils/utils.mjs";
import { samplesEmailTemplateAdmin } from "../templates/samplesEmailTemplateAdmin.mjs";
import errors from "../../../errors/errors.mjs";

/**
 * Sends the admin notification email for sample orders
 * using samplesEmailTemplateAdmin().
 */
export async function sendSamplesEmailTemplateAdmin({
  transport,
  order,
  orderId,
  live = true,
} = {}) {
  if (!order || typeof order !== "object") {
    return Promise.reject(
      errors.invalidData("sendSamplesEmailTemplateAdmin requires an order object")
    );
  }

  const normalizedLive = Boolean(live);

  // Admin recipients (from env)
  let recipients = parseEmailList(process.env.ORDER_INQUIRY_EMAILS);

  if (!normalizedLive) {
    // In preview mode, send only to TEST_RECIPIENT if set
    const test = parseEmailList(process.env.TEST_RECIPIENT);
    if (test.length) {
      recipients = test;
    }
  }

  if (!recipients.length) {
    return Promise.reject(
      errors.invalidData(
        "No admin recipients configured for Samples admin email. Check ORDER_INQUIRY_EMAILS / TEST_RECIPIENT."
      )
    );
  }

  const { subject, html } = samplesEmailTemplateAdmin({
    order,
    orderId,
    orderDate: order?.metadata?.order_date || order?.created_at,
  });

  const [toEmail, ...bccList] = recipients;

  await transport.send({
    toEmail,
    toName: "Ibogenics Admin",
    subject,
    html,
    bcc: bccList.length ? bccList : undefined,
  });

  console.log(
    `[emailService] SamplesEmailTemplateAdmin sent to ${toEmail}` +
      (bccList.length ? ` (bcc: ${bccList.join(", ")})` : "")
  );
}
