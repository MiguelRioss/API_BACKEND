import { buildSubmissionRejectionTemplate } from "../templates/SubmissionRejectionTemplate.mjs";

export async function sendSubmissionRejection({
  transport,
  userEmail,
  userName,
  rejectionReason,
  resubmitUrl,
  metadata = {},
}) {
  if (!userEmail) {
    throw new Error("userEmail is required for submission rejection");
  }

  console.log("[emailService] Sending submission rejection to:", userEmail);

  const { subject, html } = buildSubmissionRejectionTemplate({
    customerName: userName,
    rejectionReason,
    resubmitUrl,
    locale: metadata.locale,
  });

  await transport.send({
    toEmail: userEmail,
    toName: userName || "Valued Customer",
    subject,
    html,
  });

  console.log("[emailService] Submission rejection sent successfully to:", userEmail);
}

export default {
  sendSubmissionRejection,
};