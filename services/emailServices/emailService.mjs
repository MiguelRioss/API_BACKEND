import { sendThankYouEmail } from "./senders/sendThankYouEmail.mjs";
import { sendAdminNotificationEmail } from "./senders/sendAdminNotificationEmail.mjs";
import { sendContactEmail } from "./senders/sendContactEmail.mjs";
import { sendShippingEmail } from "./senders/sendShippingEmail.mjs";
import { sendOtherCountryEmail } from "./senders/sendOtherCountryEmail.mjs";
import {sendOrderBundleEmails} from "./senders/sendOrderBundleEmails.mjs"

/**
 * Email Service Factory
 * ---------------------
 * Injects the transport (Brevo, Nodemailer, etc.) and returns
 * ready-to-use senders with shared dependencies.
 */
export default function createEmailService({ transport } = {}) {
  if (!transport || typeof transport.send !== "function") {
    throw new Error("emailService expects a transport with a send() function");
  }

  return {
    sendThankYouEmail: (args) => sendThankYouEmail({ transport, ...args }),
    sendAdminNotificationEmail: (args) => sendAdminNotificationEmail({ transport, ...args }),
    sendContactEmail: (args) => sendContactEmail({ transport, ...args }),
    sendShippingEmail: (args) => sendShippingEmail({ transport, ...args }),
    sendOtherCountryEmail: (args) => sendOtherCountryEmail({ transport, ...args }),
    sendOrderBundleEmails: (args) => sendOrderBundleEmails({ transport, ...args }),
  };
}
