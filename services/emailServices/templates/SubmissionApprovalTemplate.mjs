import { escapeHtml, normalizeString, firstNonEmpty } from "./templateUtils.mjs";

export function buildSubmissionApprovalTemplate({
  customerName,
  voucherCode,
  videoUrl,
} = {}) {
  const firstName = extractFirstName(firstNonEmpty(customerName, "Customer"));
  const safeVoucherCode = normalizeString(voucherCode) || "[VOUCHER CODE]";
  const safeVideoUrl = normalizeString(videoUrl) || "#";

  const subject = buildSubmissionApprovalSubject();

  return {
    subject,
    html: [
      '<div style="font-family:Helvetica,Arial,sans-serif;color:#222;font-size:14px;line-height:1.6;">',
      `  <p style="margin:0 0 16px 0;">Hi ${escapeHtml(firstName)},</p>`,
      '  <p style="margin:0 0 16px 0;">Great news — your video is now live on the MESOBUZZ® wall! 🌟</p>',
      `  <p style="margin:0 0 16px 0;">You can view it here <a href="${escapeHtml(safeVideoUrl)}" style="color:#b87333;">${escapeHtml(safeVideoUrl)}</a></p>`,
      '  <p style="margin:0 0 16px 0;">Thank you for opening up and sharing your mesodosing journey with our community.</p>',
      '  <p style="margin:0 0 16px 0;">As promised, here\'s your 10% off voucher code:</p>',
      `  <p style="margin:16px 0; text-align:center; font-size:18px; font-weight:bold;">👉 ${escapeHtml(safeVoucherCode)} 👈</p>`,
      '  <p style="margin:0 0 16px 0;">You can use it once — either for yourself or gift it to a friend who\'s ready to start their own mesodose.</p>',
      '  <p style="margin:24px 0 8px 0;"><strong>✨ How to redeem:</strong></p>',
      '  <ol style="margin:0 0 16px 16px;padding:0;">',
      '    <li style="margin:0 0 8px 0;">Visit <a href="https://mesodose.com" style="color:#b87333;">mesodose.com</a></li>',
      '    <li style="margin:0 0 8px 0;">Choose your tincture or kit</li>',
      '    <li style="margin:0 0 8px 0;">Enter your code at checkout for 10% off</li>',
      '  </ol>',
      '  <div style="text-align:center; margin:24px 0;">',
      '    <a href="https://mesodose.com" style="background-color:#b87333; color:white; padding:12px 24px; text-decoration:none; border-radius:4px; display:inline-block;">Shop Now</a>',
      '  </div>',
      '  <p style="margin:16px 0 0 0;">Your story could be the spark someone else needs. Thanks for buzzing with us. 🌱</p>',
      '  <p style="margin:32px 0 0 0;">With appreciation,<br/><strong>The Mesodose® Team</strong></p>',
      '</div>',
    ].join("\n"),
  };
}

export function buildSubmissionApprovalSubject() {
  return "You made the MESOBUZZ® wall — enjoy 10% off!";
}

function extractFirstName(fullName) {
  if (!fullName) return "there";
  const normalized = normalizeString(fullName);
  const firstName = normalized.split(' ')[0];
  return firstName || "there";
}

export default {
  buildSubmissionApprovalTemplate,
  buildSubmissionApprovalSubject,
};