// services/transports/brevoTransport.mjs
import Brevo from "sib-api-v3-sdk";

const client = Brevo.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
const api = new Brevo.TransactionalEmailsApi();

/**
 * Transport adapter for Brevo.
 * Expected shape: transport.send({ toEmail, toName, subject, html, bcc })
 */
export default {
  async send({ toEmail, toName, subject, html, bcc }) {
    if (!process.env.BREVO_API_KEY) throw new Error("BREVO_API_KEY missing");
    if (!process.env.FROM_EMAIL) throw new Error("FROM_EMAIL missing");
    if (!toEmail) throw new Error("No recipient email");

    return api.sendTransacEmail({
      subject: subject || "Your order receipt",
      sender: {
        email: process.env.FROM_EMAIL,
        name: process.env.FROM_NAME || "Store",
      },
      to: [{ email: toEmail, name: toName || "" }],
      bcc: bcc ? [{ email: bcc, name: "Owner" }] : undefined,
      htmlContent: html,
    });
  },
};
