import { normalizeEmail, parseEmailList } from "../utils/utils.mjs";
import { buildSubmissionConfirmationTemplate } from "../templates/SubmissionConfirmationTemplate.mjs";

/**
 * Sends a submission confirmation email to the user after video upload
 * @param {Object} params
 * @param {Object} params.transport - The email transport instance
 * @param {String} params.userEmail - The user's email address
 * @param {String} params.userName - The user's full name
 * @param {Object} [params.metadata] - Optional additional metadata
 */
export async function sendSubmissionConfirmationEmail({
  transport,
  userEmail,
  userName,
  metadata = {},
}) {
  if (!userEmail) {
    throw new Error("userEmail is required for submission confirmation");
  }

  console.log("[emailService] Sending video submission confirmation to:", userEmail);

  // Build the email template
  const { subject, html } = buildSubmissionConfirmationTemplate({
    customerName: userName,
    locale: metadata.locale, // Optional locale override
  });

  // Send to the user
  await transport.send({
    toEmail: userEmail,
    toName: userName || "Valued Customer",
    subject,
    html,
  });

  console.log("[emailService] Submission confirmation sent successfully to:", userEmail);

  // Optional: Also send a copy to admin for tracking
  const adminEmail = normalizeEmail(process.env.ADMIN_NOTIFICATION_EMAIL);
  if (adminEmail && process.env.SEND_SUBMISSION_COPIES === 'true') {
    try {
      await transport.send({
        toEmail: adminEmail,
        toName: "MESOBUZZ Admin",
        subject: `[COPY] ${subject}`,
        html: `
          <div style="font-family:Helvetica,Arial,sans-serif;color:#222;font-size:14px;line-height:1.6;">
            <p><strong>Video Submission Copy:</strong> ${userName || 'Unknown user'} (${userEmail})</p>
            <hr style="margin:16px 0;">
            ${html}
          </div>
        `,
      });
      console.log("[emailService] Submission copy sent to admin:", adminEmail);
    } catch (adminError) {
      console.error("[emailService] Failed to send admin copy:", adminError);
      // Don't throw - main user email was successful
    }
  }
}

/**
 * Batch send submission confirmations to multiple users
 * @param {Object} params
 * @param {Object} params.transport - The email transport instance
 * @param {Array} params.submissions - Array of submission objects
 */
export async function sendBulkSubmissionConfirmationEmails({
  transport,
  submissions,
}) {
  if (!Array.isArray(submissions)) {
    throw new Error("submissions must be an array");
  }

  const results = {
    successful: [],
    failed: [],
  };

  for (const submission of submissions) {
    try {
      await sendSubmissionConfirmationEmail({
        transport,
        userEmail: submission.email,
        userName: submission.name,
        metadata: submission.metadata,
      });
      results.successful.push(submission.email);
    } catch (error) {
      console.error(`[emailService] Failed to send confirmation to ${submission.email}:`, error);
      results.failed.push({
        email: submission.email,
        error: error.message,
      });
    }
  }

  console.log(`[emailService] Bulk sending completed: ${results.successful.length} successful, ${results.failed.length} failed`);
  return results;
}

export default {
  sendSubmissionConfirmationEmail,
  sendBulkSubmissionConfirmationEmails,
};