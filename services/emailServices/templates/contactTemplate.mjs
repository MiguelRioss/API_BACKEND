import { escapeHtml } from "./templateUtils.mjs";
/**
 * Build the Mesodose contact form email template (for admin inbox).
 * Returns both subject and rendered HTML body.
 *
 * @param {Object} options
 * @param {string} options.name - Sender's name
 * @param {string} options.email - Sender's email
 * @param {string} options.subject - Message subject
 * @param {string} options.message - Message body
 * @param {string} options.orderId - Optional Order ID
 * @param {string} options.country - Country of sender
 */
export function buildContactEmailTemplate({
  name,
  email,
  subject,
  message,
  orderId,
  country,
} = {}) {
  const brandColor = "#b87333"; // Mesodose bronze
  const accentBg = "#fcfcf6";
  const now = new Date().toLocaleString();

  const html = `
  <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:${accentBg};
              padding:40px 0;color:#222;font-size:15px;line-height:1.6;">
    <table width="600" align="center" cellpadding="0" cellspacing="0"
           style="background:#fff;border-radius:16px;
                  box-shadow:0 2px 10px rgba(0,0,0,0.06);overflow:hidden;">
      <tr>
        <td style="background:${brandColor};text-align:center;padding:24px;">
<<<<<<< HEAD
          <img src="https://mesodose.com/logoEmail.png" alt="Mesodose" width="450" style="display:block;margin:0 auto;"/>
=======
          <img src="https://mesodose.com/logo.png" alt="Mesodose" width="160" style="display:block;margin:0 auto;"/>
>>>>>>> parent of 3d30a0f (logo size)
        </td>
      </tr>

      <tr>
        <td style="padding:32px 40px;">
          <h2 style="margin:0;font-size:20px;color:#111;">New Contact Form Message</h2>
          <p style="margin-top:4px;font-size:14px;color:#555;">
            Received via <strong>MesoContact</strong> on ${now}
          </p>

          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;"/>

          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
            <tr>
              <td width="150" style="color:#777;">Name:</td>
              <td><strong>${escapeHtml(name || "—")}</strong></td>
            </tr>
            <tr>
              <td style="color:#777;">Email:</td>
              <td><a href="mailto:${escapeHtml(email || "")}"
                     style="color:${brandColor};text-decoration:none;">
                     ${escapeHtml(email || "—")}</a></td>
            </tr>
            <tr>
              <td style="color:#777;">Country:</td>
              <td>${escapeHtml(country || "—")}</td>
            </tr>
            <tr>
              <td style="color:#777;">Order ID:</td>
              <td>${escapeHtml(orderId || "—")}</td>
            </tr>
            <tr>
              <td style="color:#777;">Subject:</td>
              <td>${escapeHtml(subject || "—")}</td>
            </tr>
          </table>

          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;"/>

          <p style="white-space:pre-wrap;font-size:15px;color:#222;">
            ${escapeHtml(message || "")}
          </p>

          <hr style="border:none;border-top:1px solid #eee;margin:30px 0;"/>

          <p style="font-size:13px;color:#888;">
            You can reply directly to <strong>${escapeHtml(email)}</strong> to respond to this customer.
          </p>
        </td>
      </tr>

      <tr>
        <td style="background:#fafafa;text-align:center;padding:16px;
                   font-size:12px;color:#999;">
          <p style="margin:0;">© ${new Date().getFullYear()} Mesodose. All rights reserved.</p>
          <p style="margin:4px 0 0;">
            <a href="https://mesodose.com" style="color:${brandColor};text-decoration:none;">
              www.mesodose.com
            </a>
          </p>
        </td>
      </tr>
    </table>
  </div>
  `;

  const subjectLine = `[MesoContact] ${subject || "New Message"}`;

  return { subject: subjectLine, html };
}
