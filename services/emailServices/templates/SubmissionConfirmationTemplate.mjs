import {
  escapeHtml,
  normalizeString,
  firstNonEmpty,
} from "./templateUtils.mjs";

/**
 * Build the submission confirmation email sent to users after video upload
 */
export function buildSubmissionConfirmationTemplate({
  customerName = "",
} = {}) {
  const firstName = extractFirstName(firstNonEmpty(customerName, "Customer"));

  const subject = buildSubmissionConfirmationSubject();

  return {
    subject,
    html: [
      '<div style="font-family:Helvetica,Arial,sans-serif;color:#222;font-size:14px;line-height:1.6;">',
      `  <p style="margin:0 0 16px 0;">Hi ${escapeHtml(firstName)},</p>`,
      '  <p style="margin:0 0 16px 0;">Thank you for sending us your video — we\'ve received it! 🙌</p>',
      '  <p style="margin:0 0 16px 0;">Our team will review it shortly. Once approved, it will appear on the MESOBUZZ® community wall, and you\'ll also receive your 10% discount voucher as a thank-you.</p>',
      '  <p style="margin:0 0 16px 0;">We\'ll email you again as soon as your video is live.</p>',
      '  <p style="margin:0 0 16px 0;">Your journey inspires others — thanks for being part of MESOBUZZ®. 🌿</p>',
      // Add this line:
      '  <p style="margin:0 0 16px 0;font-size:12px;color:#666;"><em>📧 Note: Our emails sometimes arrive in Promotions or Spam folders. Please check there if you don\'t see our messages.</em></p>',
      '  <p style="margin:32px 0 0 0;">With gratitude,<br/><strong>The Mesodose® Team</strong><br/>' +
        '<a href="https://mesodose.com/mesobuzz" style="color:#b87333;text-decoration:none;">Visit MESOBUZZ Page</a></p>',
      "</div>",
    ].join("\n"),
  };
}

export function buildSubmissionConfirmationSubject() {
  return "🌱 We've received your MESOBUZZ® video!";
}

/**
 * Extract first name from full name
 */
function extractFirstName(fullName) {
  if (!fullName) return "there";

  const normalized = normalizeString(fullName);
  const firstName = normalized.split(" ")[0];
  return firstName || "there";
}

export default {
  buildSubmissionConfirmationTemplate,
  buildSubmissionConfirmationSubject,
};
