import { normalizeEmail } from "../utils/utils.mjs";
import { buildOtherCountrysTemplateEmail } from "../templates/otherCountrysTemplateEmail.mjs";
import errors from "../../../errors/errors.mjs";

/**
 * Sends Wise / Revolut payment instruction emails
 * for countries not using Stripe checkout.
 */
export async function sendOtherCountryEmail({
  transport,
  order,
  orderId,
  live = true,
} = {}) {
  if (!order || typeof order !== "object") {
    return Promise.reject(errors.invalidData("sendOtherCountryEmail requires an order object"));
  }

  const normalizedLive = Boolean(live);
  const orderEmail = normalizeEmail(order?.email || order?.metadata?.email);

  // if in preview mode, send to test recipient
  const toEmail = normalizedLive
    ? orderEmail
    : normalizeEmail(process.env.TEST_RECIPIENT) || orderEmail;

  if (!toEmail) {
    return Promise.reject(errors.invalidData("No recipient email for OtherCountryEmail."));
  }

  const toName = normalizedLive
    ? order?.name ||
      order?.metadata?.shipping_address?.name ||
      "Customer"
    : "Ibogenics Template Preview";

  const { subject, html } = buildOtherCountrysTemplateEmail({
    order,
    orderId,
  });

 
 //Ask
  const bccEmail = normalizedLive
    ? normalizeEmail(process.env.OWNER_EMAIL)
    : undefined;

  try {
    await transport.send({
      toEmail,
      toName,
      subject,
      html,
      bcc: undefined,
    });

    console.log(`[emailService] OtherCountryEmail sent to ${toEmail}`);
  } catch (err) {
    console.error("[emailService] Failed to send OtherCountryEmail:", err?.message || err);
    throw err;
  }
}
