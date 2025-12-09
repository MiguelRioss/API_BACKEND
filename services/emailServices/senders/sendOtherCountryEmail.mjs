import { normalizeEmail, parseEmailList } from "../utils/utils.mjs";
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
    return Promise.reject(
      errors.invalidData("sendOtherCountryEmail requires an order object")
    );
  }

  const normalizedLive = Boolean(live);
  const orderEmail = normalizeEmail(order?.email || order?.metadata?.email);

  // if in preview mode, send to test recipient
  const toEmail = normalizedLive
    ? orderEmail
    : normalizeEmail(process.env.TEST_RECIPIENT) || orderEmail;

  if (!toEmail) {
    return Promise.reject(
      errors.invalidData("No recipient email for OtherCountryEmail.")
    );
  }

  const toName = normalizedLive
    ? order?.name ||
      order?.metadata?.shipping_address?.name ||
      "Customer"
    : "Ibogenics Template Preview";

  // 🔗 Normalize discount from metadata (supports both object and flat fields)
  const metaDisc =
    order?.metadata?.discount && typeof order.metadata.discount === "object"
      ? order.metadata.discount
      : undefined;

  const discount = (() => {
    const code =
      metaDisc?.code ?? order?.metadata?.discount_code ?? undefined;
    const percentSrc =
      metaDisc?.percent ?? order?.metadata?.discount_percent ?? undefined;
    const amountCentsSrc =
      metaDisc?.amount_cents ??
      order?.metadata?.discount_amount_cents ??
      undefined;

    const percent = Number.isFinite(Number(percentSrc))
      ? Math.max(0, Math.trunc(Number(percentSrc)))
      : undefined;

    const amount_cents = Number.isFinite(Number(amountCentsSrc))
      ? Math.max(0, Number(amountCentsSrc))
      : undefined;

    // Only pass if *something* is present
    if (code || percent != null || amount_cents != null) {
      return {
        ...(code ? { code: String(code) } : {}),
        ...(percent != null ? { percent } : {}),
        ...(amount_cents != null ? { amount_cents } : {}),
      };
    }
    return undefined;
  })();

  const { subject, html } = buildOtherCountrysTemplateEmail({
    order,
    orderId,
    discount,
  });

  // 🔁 Use parseEmailList for forwarding list (only in live mode)
  const bccList = normalizedLive
    ? parseEmailList(process.env.ORDER_INQUIRY_EMAILS).filter(
        (email) => email && email !== toEmail
      )
    : [];

  const bcc = bccList.length ? bccList : undefined;

  try {
    await transport.send({
      toEmail,
      toName,
      subject,
      html,
      bcc,
    });

    console.log(
      `[emailService] OtherCountryEmail sent to ${toEmail}` +
        (bcc ? ` (bcc: ${bccList.join(", ")})` : "")
    );
  } catch (err) {
    console.error(
      "[emailService] Failed to send OtherCountryEmail:",
      err?.message || err
    );
    throw err;
  }
}
