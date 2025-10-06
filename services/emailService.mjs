import Brevo from "sib-api-v3-sdk";

const client = Brevo.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
const api = new Brevo.TransactionalEmailsApi();

export async function sendInvoiceEmail({ toEmail, toName, ownerEmail, html }) {
  if (!toEmail) throw new Error("No recipient email");
  return api.sendTransacEmail({
    subject: "Your order receipt",
    sender: { email: process.env.FROM_EMAIL, name: process.env.FROM_NAME || "Store" },
    to: [{ email: toEmail, name: toName || "" }],
    bcc: ownerEmail ? [{ email: ownerEmail, name: "Owner" }] : undefined,
    htmlContent: html,
  });
}
