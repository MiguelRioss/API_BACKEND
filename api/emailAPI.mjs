// api/emailAPI.mjs
import errors from "../errors/errors.mjs";
import handlerFactory from "../utils/handleFactory.mjs";

export default function createEmailAPI(emailService) {
  const hasContact =
    emailService && typeof emailService.sendContactEmail === "function";
  const hasOrderEmails =
    emailService && typeof emailService.sendOrderBundleEmails === "function";
  const hasShipping =
    emailService && typeof emailService.sendShippingEmail === "function";
  const otherCountries =
    emailService && typeof emailService.sendOtherCountryEmail === "function";
  const hasSubmission =
    emailService && typeof emailService.sendSubmissionConfirmationEmail === "function";
  const hasAdminNotification =
    emailService && typeof emailService.sendAdminSubmissionNotification === "function";
  const hasApproval =
    emailService && typeof emailService.sendSubmissionApproval === "function";
  const hasRejection =
    emailService && typeof emailService.sendSubmissionRejection === "function";

  if (!hasContact || !hasOrderEmails || !hasShipping || !otherCountries || 
      !hasSubmission || !hasAdminNotification || !hasApproval || !hasRejection) {
    throw "API dependency invalid";
  }

  return {
    handleContactForm: handlerFactory(internalHandleContactForm),
    handleSendThankYouAndAdmin: handlerFactory(internalSendThankYouAndAdmin),
    handleShippingEmail: handlerFactory(internalHandleShippingEmail),
    handleSendInquiryOrderEmails: handlerFactory(internalSendInquiryOrderEmails),
    handleVideoSubmission: handlerFactory(internalHandleVideoSubmission),
    handleAdminSubmissionNotification: handlerFactory(internalHandleAdminSubmissionNotification),
    handleSubmissionApproval: handlerFactory(internalHandleSubmissionApproval),
    handleSubmissionRejection: handlerFactory(internalHandleSubmissionRejection),
  };

  async function internalHandleContactForm(req, res) {
    const { name, email, subject, message, orderId, country } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await emailService.sendContactEmail({
      name,
      email,
      subject,
      message,
      orderId,
      country,
    });

    return res.status(200).json({
      description: "Message Sent",
      uri: "/api/contactUs",
    });
  }

  async function internalSendThankYouAndAdmin(req, res) {
    const { order, orderId, logoPath, live } = req.body || {};

    if (!order || typeof order !== "object") {
      return errors.badRequest("Missing order payload");
    }

    const resolvedOrderId = orderId || order?.id;
    if (!resolvedOrderId) {
      return errors.badRequest("Order id is required");
    }

    const normalizedLive =
      typeof live === "string" ? live.toLowerCase() === "true" : Boolean(live);

    await emailService.sendOrderBundleEmails({
      order,
      orderId: resolvedOrderId,
      logoPath,
      live: normalizedLive,
    });

    return res.status(200).json({
      description: "Invoice email sent",
      orderId: resolvedOrderId,
      uri: "/api/email/invoice",
    });
  }

  async function internalHandleShippingEmail(req, res) {
    const {
      order,
      orderId,
      orderDate,
      invoiceId,
      trackingNumber,
      trackingUrl,
      locale,
      live,
    } = req.body || {};

    if (!order || typeof order !== "object") {
      return res.status(400).json({ error: "Missing order payload" });
    }

    const resolvedOrderId = orderId || order?.id;
    if (!resolvedOrderId) {
      return res.status(400).json({ error: "Order id is required" });
    }

    const normalizedLive =
      typeof live === "string" ? live.toLowerCase() === "true" : Boolean(live);

    await emailService.sendShippingEmail({
      order,
      orderId: resolvedOrderId,
      orderDate,
      invoiceId,
      trackingNumber,
      trackingUrl,
      locale,
      live: normalizedLive,
    });

    return res.status(200).json({
      description: "Shipping email sent",
      orderId: resolvedOrderId,
      uri: "/api/email/shipping",
    });
  }

  async function internalSendInquiryOrderEmails(req, res) {
    const { order, orderId, logoPath, live } = req.body || {};

    if (!order || typeof order !== "object") {
      return res.status(400).json({ error: "Missing order payload" });
    }

    const resolvedOrderId = orderId || order?.id;
    if (!resolvedOrderId) {
      return res.status(400).json({ error: "Order id is required" });
    }

    const normalizedLive =
      typeof live === "string" ? live.toLowerCase() === "true" : Boolean(live);

    try {
      await emailService.sendInquiryOrderBundleEmails({
        order,
        orderId: resolvedOrderId,
        logoPath,
        live: normalizedLive,
      });

      return res.status(200).json({
        description: "Inquiry order bundle emails sent (Other Country + Admin)",
        orderId: resolvedOrderId,
        uri: "/api/email/inquiry",
      });
    } catch (err) {
      console.error("[emailAPI] Failed to send inquiry order emails:", err);
      return res.status(500).json({
        error: "Failed to send inquiry order bundle emails",
        details: err.message,
      });
    }
  }

  async function internalHandleVideoSubmission(req, res) {
    const { userEmail, userName } = req.body || {};

    if (!userEmail) {
      return res.status(400).json({ error: "User email is required" });
    }

    try {
      await emailService.sendSubmissionConfirmationEmail({
        userEmail,
        userName,
      });

      return res.status(200).json({
        description: "Video submission confirmation sent",
        userEmail,
        uri: "/api/email/video-submission",
      });
    } catch (err) {
      console.error("[emailAPI] Failed to send video submission confirmation:", err);
      return res.status(500).json({
        error: "Failed to send video submission confirmation",
        details: err.message,
      });
    }
  }

  async function internalHandleAdminSubmissionNotification(req, res) {
    const {
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
    } = req.body || {};

    if (!userEmail || !userName) {
      return res.status(400).json({ error: "User email and name are required" });
    }

    try {
      await emailService.sendAdminSubmissionNotification({
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
      });

      return res.status(200).json({
        description: "Admin submission notification sent",
        submissionId,
        uri: "/api/email/admin-submission-notification",
      });
    } catch (err) {
      console.error("[emailAPI] Failed to send admin submission notification:", err);
      return res.status(500).json({
        error: "Failed to send admin submission notification",
        details: err.message,
      });
    }
  }

  async function internalHandleSubmissionApproval(req, res) {
    //Voucher code is created in services
    const { userEmail, userName, videoUrl } = req.body || {};

    if (!userEmail || !voucherCode) {
      return res.status(400).json({ error: "User email and voucher code are required" });
    }

    try {
      await emailService.sendSubmissionApproval({
        userEmail,
        userName,
        videoUrl,
      });

      return res.status(200).json({
        description: "Submission approval sent",
        userEmail,
        uri: "/api/email/submission-approval",
      });
    } catch (err) {
      console.error("[emailAPI] Failed to send submission approval:", err);
      return res.status(500).json({
        error: "Failed to send submission approval",
        details: err.message,
      });
    }
  }

  async function internalHandleSubmissionRejection(req, res) {
    const { userEmail, userName, rejectionReason, resubmitUrl } = req.body || {};

    if (!userEmail || !rejectionReason) {
      return res.status(400).json({ error: "User email and rejection reason are required" });
    }

    try {
      await emailService.sendSubmissionRejection({
        userEmail,
        userName,
        rejectionReason,
        resubmitUrl,
      });

      return res.status(200).json({
        description: "Submission rejection sent",
        userEmail,
        uri: "/api/email/submission-rejection",
      });
    } catch (err) {
      console.error("[emailAPI] Failed to send submission rejection:", err);
      return res.status(500).json({
        error: "Failed to send submission rejection",
        details: err.message,
      });
    }
  }
}