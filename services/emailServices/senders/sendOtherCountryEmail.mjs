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
    throw errors.invalidData("sendOtherCountryEmail requires an order object");
  }

  const normalizedLive = Boolean(live);
  const orderEmail = normalizeEmail(order?.email || order?.metadata?.email);
  if (!orderEmail) {
    throw errors.invalidData("Order has no valid email address");
  }

  const toName =
    order?.name || order?.metadata?.shipping_address?.name || "Customer";

  // 🔗 Normalize discount from metadata (supports both object and flat fields)
  const metaDisc =
    order?.metadata?.discount && typeof order.metadata.discount === "object"
      ? order.metadata.discount
      : undefined;

  const discount = (() => {
    const code = metaDisc?.code ?? order?.metadata?.discount_code ?? undefined;
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

  const { subject, html } = buildOtherCountrysTemplateEmail({
    order,
    orderId,
    discount,
  });

  // 👇 Forward / BCC setup
  const toEmail = process.env.ORDER_INQUIRY_EMAILS;
  if (!toEmail) throw errors.invalidData("ORDER_INQUIRY_EMAILS not configured");

  // In preview mode, override for safety
  const bcc = normalizedLive
    ? process.env.TEST_RECIPIENT
    : normalizeEmail(process.env.TEST_RECIPIENT);

  // ✅ Use same field names and structure as working sendContactEmail
  await transport.send({
    toEmail,
    toName: "Mesodose Orders",
    subject,
    html,
    replyTo: { email: orderEmail, name: toName },
    bcc,
  });

  console.log(`[emailService] OtherCountryEmail sent to ${orderEmail}`);
}
