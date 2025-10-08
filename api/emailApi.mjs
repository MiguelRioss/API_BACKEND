// api/contactAPI.mjs
import handlerFactory from "../utils/handleFactory.mjs";

/**
 * Contact API
 * -----------
 * Receives POST /api/contactUs
 * Delegates to emailService.sendContactEmail().
 */
export default function createEmailAPI(emailService) {
  if (!emailService || typeof emailService.sendContactEmail !== "function") {
    throw "API dependency invalid";
  }

  return {
    handleContactForm: handlerFactory(internalHandleContactForm),
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
}
