import { buildContactEmailTemplate } from "../templates/contactTemplate.mjs";
import errors from "../../../errors/errors.mjs";

export async function sendContactEmail({ transport, name, email, subject, message, orderId, country }) {
  const toEmail = process.env.CONTACT_US_FORWARD_EMAIL;
  if (!toEmail) throw errors.invalidData("CONTACT_US_FORWARD_EMAIL not configured");

  const { subject: subjectLine, html } = buildContactEmailTemplate({
    name, email, subject, message, orderId, country,
  });

  await transport.send({
    toEmail,
    toName: "Mesodose Team",
    subject: subjectLine,
    html,
    replyTo: { email, name },
    bcc: process.env.TEST_RECIPIENT || undefined,
  });
}
