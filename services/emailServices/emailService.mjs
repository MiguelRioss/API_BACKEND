import { sendThankYouEmail } from "./senders/sendThankYouEmail.mjs";
import { sendAdminNotificationEmail } from "./senders/sendAdminNotificationEmail.mjs";
import { sendContactEmail } from "./senders/sendContactEmail.mjs";
import { sendShippingEmail } from "./senders/sendShippingEmail.mjs";
import { sendOtherCountryEmail } from "./senders/sendOtherCountryEmail.mjs";
import { sendOrderBundleEmails } from "./senders/sendOrderBundleEmails.mjs";
import { sendInquiryOrderBundleEmails } from "./senders/sendInquiryOrderBundleEmails.mjs";
import { sendSubmissionConfirmationEmail } from "./senders/sendSubmissionConfirmationEmail.mjs";
import { sendAdminSubmissionNotification } from "./senders/sendAdminSubmissionNotification.mjs";
import { sendSubmissionApproval } from "./senders/sendSubmissionApproval.mjs";
import { sendSubmissionRejection } from "./senders/sendSubmissionRejection.mjs";
import { sendSampleOrderBundleEmails } from "./senders/sendSampleOrderBundleEmails.mjs";

export default function createEmailService({ transport } = {}) {
  if (!transport || typeof transport.send !== "function") {
    throw new Error("emailService expects a transport with a send() function");
  }

  // 👇 NEW: simple stub, just logs
  function sendSampleOrderEmails({ order, orderId }) {
    console.log("[emailService] Sample order EMAIL STUB triggered:", {
      orderId,
      email: order?.email || order?.customer?.email || null,
      name: order?.name || order?.customer?.name || null,
    });
  }

  return {
    sendThankYouEmail: (args) => sendThankYouEmail({ transport, ...args }),
    sendAdminNotificationEmail: (args) =>
      sendAdminNotificationEmail({ transport, ...args }),
    sendContactEmail: (args) => sendContactEmail({ transport, ...args }),
    sendShippingEmail: (args) => sendShippingEmail({ transport, ...args }),
    sendOtherCountryEmail: (args) =>
      sendOtherCountryEmail({ transport, ...args }),
    sendOrderBundleEmails: (args) =>
      sendOrderBundleEmails({ transport, ...args }),
    sendInquiryOrderBundleEmails: (args) =>
      sendInquiryOrderBundleEmails({ transport, ...args }),
    sendSubmissionConfirmationEmail: (args) =>
      sendSubmissionConfirmationEmail({ transport, ...args }),
    sendAdminSubmissionNotification: (args) =>
      sendAdminSubmissionNotification({ transport, ...args }),
    sendSubmissionApproval: (args) =>
      sendSubmissionApproval({ transport, ...args }),
    sendSubmissionRejection: (args) =>
      sendSubmissionRejection({ transport, ...args }),

    sendSamplesEmailTemplateClient: (args) =>
      sendSamplesEmailTemplateClient({ transport, ...args }),
    sendSamplesEmailTemplateAdmin: (args) =>
      sendSamplesEmailTemplateAdmin({ transport, ...args }),
    sendSamplesBundleEmails: (args) =>
      sendSampleOrderBundleEmails({ transport, ...args }),
  };
}
