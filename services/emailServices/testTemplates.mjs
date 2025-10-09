import "dotenv/config";
import brevoTransport from "./brevoTransports.mjs";
import { buildThankTemplate } from "./thankTemplate.mjs";
import { buildAdminNotificationTemplate } from "./adminTemplate.mjs";
import orderFixture from "../emailObjectAfterValidationMapper.js";

const DEFAULT_RECIPIENT = "miguelangelorios5f@gmail.com";

/**
 * Sends both customer-facing and admin notification emails using the provided order.
 * Intended for manual verification of template content through Brevo.
 */
export async function sendTemplatePreviews({
  order = orderFixture,
  toEmail = DEFAULT_RECIPIENT,
  orderId = "ORDER-PREVIEW-001",
  live = false,
} = {}) {
  if (!toEmail) throw new Error("Recipient email is required for template preview");

  const baseOrderDate = new Date();

  const thankYou = buildThankTemplate({
    order,
    orderId,
    orderDate: baseOrderDate,
  });

  await brevoTransport.send({
    toEmail,
    toName: order?.name || "Template Preview",
    subject: thankYou.subject,
    html: thankYou.html,
    bcc: live ? process.env.OWNER_EMAIL || undefined : undefined,
  });

  const admin = buildAdminNotificationTemplate({
    order,
    orderId,
    orderDate: baseOrderDate,
  });

  await brevoTransport.send({
    toEmail,
    toName: "Ibogenics Admin Preview",
    subject: admin.subject,
    html: admin.html,
    bcc: live ? process.env.OWNER_EMAIL || undefined : undefined,
  });
}

async function main() {
  try {
    await sendTemplatePreviews();
    console.log("Preview emails sent successfully.");
  } catch (err) {
    console.error("Failed to send preview emails:", err?.message || err);
    process.exitCode = 1;
  }
}

main();
