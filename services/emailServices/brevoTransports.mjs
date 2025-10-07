// services/emailServices/brevoTransports.mjs
import fs from "node:fs/promises";
import path from "node:path";
import Brevo from "sib-api-v3-sdk";

const client = Brevo.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
const api = new Brevo.TransactionalEmailsApi();

/**
 * Transport adapter for Brevo.
 * Supports attachments via [{ filename, path, contentType, content }]
 */
export default {
  async send({ toEmail, toName, subject, html, bcc, attachments = [] } = {}) {
    if (!process.env.BREVO_API_KEY) throw new Error("BREVO_API_KEY missing");
    if (!process.env.FROM_EMAIL) throw new Error("FROM_EMAIL missing");
    if (!toEmail) throw new Error("No recipient email provided");

    const brevoAttachments = await Promise.all(
      attachments
        .filter(Boolean)
        .map(async (attachment) => {
          const encoded = await toBase64Attachment(attachment);
          return encoded;
        })
    );

    return api.sendTransacEmail({
      subject: subject || "Your order receipt",
      sender: {
        email: process.env.FROM_EMAIL,
        name: process.env.FROM_NAME || "Ibogenics",
      },
      to: [{ email: toEmail, name: toName || "" }],
      bcc: bcc ? [{ email: bcc, name: "Owner" }] : undefined,
      htmlContent: html,
      attachment: brevoAttachments.length ? brevoAttachments : undefined,
    });
  },
};

async function toBase64Attachment({ filename, path: filePath, content, contentType }) {
  if (!content && !filePath) {
    throw new Error("Attachment requires either content or path");
  }

  if (!filename) {
    filename = filePath ? path.basename(filePath) : "attachment";
  }

  let base64Content;
  if (content) {
    base64Content = Buffer.isBuffer(content) ? content.toString("base64") : String(content);
  } else {
    const file = await fs.readFile(filePath);
    base64Content = file.toString("base64");
  }

  const attachment = {
    name: filename,
    content: base64Content,
  };

  if (contentType) {
    attachment.type = contentType;
  }

  return attachment;
}
