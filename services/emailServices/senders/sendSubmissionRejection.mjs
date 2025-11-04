// emailServices/sendSubmissionRejection.mjs
import { buildSubmissionRejectionTemplate } from "../templates/SubmissionRejectionTemplate.mjs";

/**
 * Send rejection email with optional reviewer notes.
 * @param {Object} params
 * @param {Object} params.transport - mail transport with `.send({ toEmail, toName, subject, html, text? })`
 * @param {string} params.userEmail
 * @param {string} [params.userName]
 * @param {string} [params.rejectionReason]
 * @param {string} [params.rejectionNotes]   // <-- NEW
 * @param {string} [params.resubmitUrl]
 */
export async function sendSubmissionRejection({
  transport,
  userEmail,
  userName,
  rejectionReason,
  rejectionNotes,        // <-- NEW
  resubmitUrl,
}) {
  if (!userEmail) throw new Error("userEmail is required for submission rejection");

  console.log("[emailService] Sending submission rejection to:", userEmail);

  const { subject, html } = buildSubmissionRejectionTemplate({
    customerName: userName,
    rejectionReason,
    rejectionNotes,      // <-- pass to template
    resubmitUrl,
  });

  // (Optional) plain text fallback from HTML (very simple)
  const text =
    `Hi ${userName || "there"},\n\n` +
    `Thanks for your MESOBUZZ submission.\n` +
    `Reason: ${rejectionReason || "Content not suitable for publishing"}\n` +
    (rejectionNotes ? `\nNotes about rejection:\n${rejectionNotes}\n` : "") +
    `\nResubmit here: ${resubmitUrl || "https://mesodose.com/mesobuzz/upload"}\n\n` +
    `— The Mesodose Team`;

  await transport.send({
    toEmail: userEmail,
    toName: userName || "Valued Customer",
    subject,
    html,
    text, // nice to have
  });

  console.log("[emailService] Submission rejection sent successfully to:", userEmail);
}

export default { sendSubmissionRejection };
