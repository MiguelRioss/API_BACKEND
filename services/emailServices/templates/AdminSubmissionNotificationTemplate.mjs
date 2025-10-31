import { escapeHtml, normalizeString, firstNonEmpty, formatOrderDate } from "./templateUtils.mjs";

export function buildAdminSubmissionNotificationTemplate({
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
  locale,
} = {}) {
  const safeName = normalizeString(userName) || "Unknown User";
  const safeEmail = normalizeString(userEmail) || "No email provided";
  const safeCity = normalizeString(city) || "—";
  const safeCountry = normalizeString(country) || "—";
  const safeSubmissionId = normalizeString(submissionId) || "pending";
  const consentText = consent ? "Yes" : "No";
  const formattedDate = formatOrderDate(submittedAt, locale);
  const safeFileName = normalizeString(fileName) || "No file name";
  const safeDuration = normalizeString(videoDuration) || "Unknown";
  const safeThumbnail = normalizeString(thumbnailUrl) || "#";

  const subject = buildAdminSubmissionNotificationSubject({
    userName: safeName,
    city: safeCity,
    country: safeCountry,
  });

  return {
    subject,
    html: [
      '<div style="font-family:Helvetica,Arial,sans-serif;color:#222;font-size:14px;line-height:1.6;">',
      '  <h2 style="margin:0 0 16px 0;">New MESOBUZZ submission awaiting review</h2>',
      '  <p style="margin:0 0 16px 0;">Hi team,</p>',
      '  <p style="margin:0 0 16px 0;">A new MESOBUZZ submission is awaiting review.</p>',
      '  <p style="margin:24px 0 8px 0;"><strong>Submission details:</strong></p>',
      '  <table style="margin:0 0 16px 0; font-size:14px;">',
      `    <tr><td style="padding:0 12px 4px 0; color:#555;">Name:</td><td><strong>${escapeHtml(safeName)}</strong></td></tr>`,
      `    <tr><td style="padding:0 12px 4px 0; color:#555;">Email:</td><td>${escapeHtml(safeEmail)}</td></tr>`,
      `    <tr><td style="padding:0 12px 4px 0; color:#555;">City:</td><td>${escapeHtml(safeCity)}</td></tr>`,
      `    <tr><td style="padding:0 12px 4px 0; color:#555;">Country:</td><td>${escapeHtml(safeCountry)}</td></tr>`,
      `    <tr><td style="padding:0 12px 4px 0; color:#555;">Submission ID:</td><td>${escapeHtml(safeSubmissionId)}</td></tr>`,
      `    <tr><td style="padding:0 12px 4px 0; color:#555;">Consent to publish:</td><td>${escapeHtml(consentText)}</td></tr>`,
      `    <tr><td style="padding:0 12px 4px 0; color:#555;">Received:</td><td>${escapeHtml(formattedDate)}</td></tr>`,
      '  </table>',
      '  <p style="margin:16px 0 8px 0;"><strong>File:</strong></p>',
      '  <table style="margin:0 0 16px 0; font-size:14px;">',
      `    <tr><td style="padding:0 12px 4px 0; color:#555;">Filename:</td><td>${escapeHtml(safeFileName)}</td></tr>`,
      `    <tr><td style="padding:0 12px 4px 0; color:#555;">Duration:</td><td>${escapeHtml(safeDuration)}</td></tr>`,
      `    <tr><td style="padding:0 12px 4px 0; color:#555;">Preview link:</td><td><a href="${escapeHtml(safeThumbnail)}" style="color:#b87333;">View Thumbnail</a></td></tr>`,
      '  </table>',
      '  <p style="margin:24px 0 8px 0;"><strong>Review Actions:</strong></p>',
      '  <p style="margin:16px 0 0 0;">Once approved, the system will automatically email the user their 10% voucher.</p>',
      '  <p style="margin:32px 0 0 0;">Thanks,<br/><strong>MESODOSE • MESOBUZZ</strong></p>',
      '</div>',
    ].join("\n"),
  };
}

export function buildAdminSubmissionNotificationSubject({ userName, city, country }) {
  const safeName = normalizeString(userName) || "User";
  const safeCity = normalizeString(city) || "Unknown City";
  const safeCountry = normalizeString(country) || "Unknown Country";
  return `Pending MESOBUZZ approval — ${safeName}, ${safeCity}, ${safeCountry}`;
}

export default {
  buildAdminSubmissionNotificationTemplate,
  buildAdminSubmissionNotificationSubject,
};