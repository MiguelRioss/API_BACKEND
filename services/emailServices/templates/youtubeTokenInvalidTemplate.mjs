import { escapeHtml, formatOrderDate, normalizeString } from "./templateUtils.mjs";

export function buildYouTubeTokenInvalidTemplate({
  errorCode,
  errorDescription,
  occurredAt,
  environment,
} = {}) {
  const safeCode = normalizeString(errorCode) || "invalid_grant";
  const safeDescription =
    normalizeString(errorDescription) || "Token refresh rejected by Google.";
  const safeEnvironment = normalizeString(environment) || "unknown";
  const formattedDate = formatOrderDate(occurredAt);

  const subject = "Action required: YouTube refresh token invalid";

  return {
    subject,
    html: [
      '<div style="font-family:Helvetica,Arial,sans-serif;color:#222;font-size:14px;line-height:1.6;">',
      '  <h2 style="margin:0 0 16px 0;">YouTube token refresh failed</h2>',
      '  <p style="margin:0 0 16px 0;">The YouTube OAuth refresh token is no longer valid. Please reauthorize and update the stored refresh token.</p>',
      '  <table style="margin:0 0 16px 0; font-size:14px;">',
      `    <tr><td style="padding:0 12px 4px 0; color:#555;">Error code:</td><td>${escapeHtml(safeCode)}</td></tr>`,
      `    <tr><td style="padding:0 12px 4px 0; color:#555;">Error description:</td><td>${escapeHtml(safeDescription)}</td></tr>`,
      `    <tr><td style="padding:0 12px 4px 0; color:#555;">Environment:</td><td>${escapeHtml(safeEnvironment)}</td></tr>`,
      `    <tr><td style="padding:0 12px 4px 0; color:#555;">Occurred at:</td><td>${escapeHtml(formattedDate)}</td></tr>`,
      "  </table>",
      '  <p style="margin:0 0 8px 0;"><strong>Next steps</strong></p>',
      '  <ol style="margin:0 0 16px 20px;padding:0;">',
      "    <li>Reauthorize the YouTube OAuth consent for the upload scope.</li>",
      "    <li>Update the YT_REFRESH_TOKEN value in the server environment.</li>",
      "    <li>Restart the service or re-run the approval upload.</li>",
      "  </ol>",
      '  <p style="margin:0;">If the consent screen is in testing mode, refresh tokens can expire after 7 days.</p>',
      "</div>",
    ].join("\n"),
  };
}

export default {
  buildYouTubeTokenInvalidTemplate,
};
