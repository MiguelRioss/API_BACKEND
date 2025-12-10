// samplesEmailTemplateClient.mjs
import { normalizeEmail, parseEmailList } from "../utils/utils.mjs";
import { samplesEmailTemplate } from "../templates/samplesEmailTemplateClient.mjs";
import errors from "../../../errors/errors.mjs";

/**
 * Sends the "other countries" payment instructions email
 * using the buildOtherCountrysTemplateEmail() template.
 *
 * You can use this for samples or manual orders by calling it
 * from ordersService with whatever options you like.
 */
export async function sendSamplesEmailTemplateClient({
  transport,
  order,
  orderId,
  live = true,
} = {}) {
  if (!order || typeof order !== "object") {
    return Promise.reject(
      errors.invalidData("sendSamplesEmailTemplateClient requires an order object")
    );
  }

  const normalizedLive = Boolean(live);
  const orderEmail = normalizeEmail(order?.email || order?.metadata?.email);

  // In non-live / preview mode, send to TEST_RECIPIENT instead
  const toEmail = normalizedLive
    ? orderEmail
    : normalizeEmail(process.env.TEST_RECIPIENT) || orderEmail;

  if (!toEmail) {
    return Promise.reject(
      errors.invalidData("No recipient email for SamplesEmailTemplateClient.")
    );
  }

  const toName = normalizedLive
    ? order?.name ||
      order?.metadata?.shipping_address?.name ||
      "Customer"
    : "Ibogenics Template Preview";

  // Optional: normalize discount from metadata
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

    if (code || percent != null || amount_cents != null) {
      return {
        ...(code ? { code: String(code) } : {}),
        ...(percent != null ? { percent } : {}),
        ...(amount_cents != null ? { amount_cents } : {}),
      };
    }
    return undefined;
  })();

  // Build subject/html/text from your template
  const { subject, html, text } = samplesEmailTemplate({
    order,
    orderId,
    discount,
  });

  // Forwarding list (only when live)
  const bccList = normalizedLive
    ? parseEmailList(process.env.ORDER_INQUIRY_EMAILS).filter(
        (email) => email && email !== toEmail
      )
    : [];

  const bcc = bccList.length ? bccList : undefined;

  // For now this WILL send. If you only want to test, comment transport.send and keep the console.log.
  try {
    await transport.send({
      toEmail,
      toName,
      subject,
      html,
      text, // if your transport supports text
      bcc,
    });

    console.log(
      `[emailService] SamplesEmailTemplateClient sent to ${toEmail}` +
        (bcc ? ` (bcc: ${bccList.join(", ")})` : "")
    );
  } catch (err) {
    console.error(
      "[emailService] Failed to send SamplesEmailTemplateClient:",
      err?.message || err
    );
    throw err;
  }
}
