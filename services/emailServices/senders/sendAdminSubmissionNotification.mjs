import { normalizeEmail, parseEmailList } from "../utils/utils.mjs";
import { buildAdminSubmissionNotificationTemplate } from "../templates/AdminSubmissionNotificationTemplate.mjs";

export async function sendAdminSubmissionNotification({
  transport,
  userName,
  userEmail,
  city,
  country,
  submissionId,
  consent,
  submittedAt,
  fileName,
  videoDuration,
  thumbnailUrl,
  metadata = {},
}) {
  const adminEmail = normalizeEmail(process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ORDER_EMAIL);
  const forwardEmails = parseEmailList(process.env.ORDER_FORWARD_EMAILS || "");

  if (!adminEmail) throw new Error("ADMIN_NOTIFICATION_EMAIL missing");

  const recipients = [
    { email: adminEmail, name: "MESOBUZZ Admin Team" },
    ...forwardEmails.map(email => ({ email, name: "Tech" })),
  ];

  const { subject, html } = buildAdminSubmissionNotificationTemplate({
    userName,
    userEmail,
    city,
    country,
    submissionId,
    consent,
    submittedAt,
    fileName,
    videoDuration,
    thumbnailUrl,
    locale: metadata.locale,
  });

  for (const r of recipients) {
    await transport.send({
      toEmail: r.email,
      toName: r.name,
      subject,
      html,
    });
  }
}

export default {
  sendAdminSubmissionNotification,
};