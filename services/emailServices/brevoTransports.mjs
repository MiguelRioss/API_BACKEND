import fs from "node:fs/promises";
import path from "node:path";
import Brevo from "sib-api-v3-sdk";

const client = Brevo.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
const api = new Brevo.TransactionalEmailsApi();

/**
 * Brevo transport adapter
 * -----------------------
 * Supports normal and inline attachments.
 * Accepts: { filename, path, contentType, content, contentId }
 */
export default {
  async send({
    toEmail,
    toName,
    subject,
    html,
    replyTo,
    bcc,
    attachments = [],
  } = {}) {
    // ------------------------------------------------------------
    // 1️⃣ Basic validation
    // ------------------------------------------------------------
    if (!process.env.BREVO_API_KEY) throw new Error("BREVO_API_KEY missing");
    if (!process.env.FROM_EMAIL) throw new Error("FROM_EMAIL missing");
    if (!toEmail) throw new Error("No recipient email provided");

    // ------------------------------------------------------------
    // 2️⃣ Convert attachments to Brevo-friendly format
    // ------------------------------------------------------------
    const brevoAttachments = await Promise.all(
      (attachments || []).filter(Boolean).map(async (att) => {
        let contentBase64 = att.content;

        // If only path provided, read the file
        if (!contentBase64 && att.path) {
          const fileBuffer = await fs.readFile(att.path);
          contentBase64 = fileBuffer.toString("base64");
        }

        if (!contentBase64) {
          throw new Error(`Attachment missing content: ${att.filename || att.name}`);
        }

        // Determine MIME type
        const contentType =
          att.contentType ||
          mimeFromExt(att.filename || att.name || att.path) ||
          "application/octet-stream";

        return {
          name: att.filename || att.name || path.basename(att.path || "attachment"),
          content: contentBase64,
          contentType, // ✅ required by Brevo
          contentId: att.contentId || undefined, // for inline <img src="cid:...">
        };
      })
    );

    // ------------------------------------------------------------
    // 3️⃣ Send transactional email
    // ------------------------------------------------------------
    return api.sendTransacEmail({
      subject: subject || "(no subject)",
      sender: {
        email: process.env.FROM_EMAIL,
        name: process.env.FROM_NAME || "Ibogenics",
      },
      to: [{ email: toEmail, name: toName || "" }],
      replyTo: replyTo ? { email: replyTo.email, name: replyTo.name } : undefined,
      bcc: bcc ? [{ email: bcc, name: "Owner" }] : undefined,
      htmlContent: html,
      attachment: brevoAttachments.length ? brevoAttachments : undefined,
    });
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mimeFromExt(file) {
  if (!file) return null;
  const ext = path.extname(file).toLowerCase();

  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".pdf":
      return "application/pdf";
    case ".zip":
      return "application/zip";
    case ".txt":
      return "text/plain";
    default:
      return null;
  }
}
