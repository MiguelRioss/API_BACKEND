import { normalizeEmail, parseEmailList } from "../utils/utils.mjs";
import { buildYouTubeTokenInvalidTemplate } from "../templates/youtubeTokenInvalidTemplate.mjs";

export async function sendYouTubeTokenInvalidEmail({
  transport,
  errorCode,
  errorDescription,
  occurredAt,
  environment,
  toEmail,
} = {}) {
  const primaryEmail = normalizeEmail(
    toEmail ||
      process.env.YT_TOKEN_ALERT_EMAIL ||
      process.env.ADMIN_NOTIFICATION_EMAIL ||
      process.env.ORDER_EMAIL
  );
  const forwardEmails = parseEmailList(process.env.ORDER_FORWARD_EMAILS || "");

  if (!primaryEmail) {
    throw new Error("YT_TOKEN_ALERT_EMAIL missing");
  }

  const recipients = [
    { email: primaryEmail, name: "Mesodose Admin" },
    ...forwardEmails.map((email) => ({ email, name: "Tech" })),
  ];

  const { subject, html } = buildYouTubeTokenInvalidTemplate({
    errorCode,
    errorDescription,
    occurredAt,
    environment,
  });

  for (const recipient of recipients) {
    await transport.send({
      toEmail: recipient.email,
      toName: recipient.name,
      subject,
      html,
    });
  }
}

export default {
  sendYouTubeTokenInvalidEmail,
};
