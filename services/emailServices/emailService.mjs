import os from "node:os";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import {
  escapeHtml,
  safeSlug,
  normalizeEmail,
  parseEmailList,
} from "./utils/utils.mjs";

import { buildOrderInvoiceHtml } from "./templates/emailTemplates.mjs";
import { buildThankTemplate } from "./templates/thankTemplate.mjs";
import { buildAdminNotificationTemplate } from "./templates/adminTemplate.mjs";
import { createPdfInvoice } from "./pdfInvoice.mjs";
import { buildContactEmailTemplate } from "./templates/contactTemplate.mjs";

const DEFAULT_LOGO_PATH = process.env.INVOICE_LOGO_PATH || "./assets/logo.png";
const DEFAULT_FORWARD_EMAILS = "miguelangelorios5f@gmail.com";


// -----------------------------------------------------------------------------
// Email Service Factory
// -----------------------------------------------------------------------------
export default function createEmailService({ transport } = {}) {
  if (!transport || typeof transport.send !== "function") {
    throw new Error("emailService expects a transport with a send() function");
  }

  return {
    sendOrderEmails,
    sendContactEmail,
    sendShippingEmail
  };

    // ---------------------------------------------------------------------------
    // 1️⃣ Send Order Invoice Email
    // ---------------------------------------------------------------------------
    async function sendOrderEmails({
      order,
      orderId,
      live = false,
      logoPath = DEFAULT_LOGO_PATH,
    } = {}) {
      if (!order || typeof order !== "object") {
        throw new Error("sendOrderEmails requires an order object");
      }

      const isTestRoute = !live && !!process.env.TEST_RECIPIENT;
      const toEmail = isTestRoute ? process.env.TEST_RECIPIENT : order?.email;
      const toName = isTestRoute ? "Test Recipient" : order?.name || "";

      if (!toEmail) {
        console.warn("[emailService] Skipping email send, no recipient available.");
        return;
      }

      const invoiceHtml = buildOrderInvoiceHtml({ order, orderId });
      const pdfFilename = `Invoice-${safeSlug(orderId || new Date().toISOString())}.pdf`;
      const tempPdfPath = join(os.tmpdir(), `invoice-${randomUUID()}.pdf`);

      let pdfAbsolutePath = tempPdfPath;
      let pdfBase64 = "";
      try {
        pdfAbsolutePath = await createPdfInvoice(invoiceHtml, logoPath, tempPdfPath);
        const pdfBuffer = await fs.readFile(pdfAbsolutePath);
        pdfBase64 = pdfBuffer.toString("base64");
        console.log(
          `[emailService] Generated PDF invoice at ${pdfAbsolutePath} (${pdfBuffer.length} bytes)`,
        );
      } catch (err) {
        console.error("[emailService] Failed to generate PDF invoice:", err);
        throw err;
      }

      const { subject: customerSubject, html: customerHtml } = buildThankTemplate({
        order,
        orderId,
        orderDate: order?.createdAt || order?.created_at || order?.metadata?.order_date,
      });

      const { subject: adminSubject, html: adminHtml } = buildAdminNotificationTemplate({
        order,
        orderId,
        orderDate: order?.createdAt || order?.created_at || order?.metadata?.order_date,
      });

      const pdfAttachment = pdfBase64
        ? {
          filename: pdfFilename,
          content: pdfBase64,
          contentType: "application/pdf",
        }
        : null;
      const attachmentList = pdfAttachment ? [pdfAttachment] : undefined;

      const ownerEmail = normalizeEmail(process.env.OWNER_EMAIL || "Info@ibogenics.com");
      const forwardEmails = parseEmailList(
        process.env.ORDER_FORWARD_EMAILS || DEFAULT_FORWARD_EMAILS,
      );
      console.log("[emailService] ORDER_FORWARD_EMAILS raw:", process.env.ORDER_FORWARD_EMAILS);

      const adminRecipients = [];
      if (ownerEmail) {
        adminRecipients.push({
          email: ownerEmail,
          name: "Ibogenics Admin & Logistics Team",
        });
      } else {
        console.warn("[emailService] OWNER_EMAIL not configured; skipping owner notification.");
      }

      for (const email of forwardEmails) {
        if (
          email &&
          !adminRecipients.some(
            (recipient) => recipient.email.toLowerCase() === email.toLowerCase(),
          )
        ) {
          adminRecipients.push({
            email,
            name: "Tech",
          });
        }
      }

      if (!adminRecipients.length) {
        console.warn("[emailService] No admin recipients configured for order notifications.");
      }

      console.log("[emailService] Customer recipient:", toEmail);
      console.log(
        "[emailService] Admin recipients:",
        adminRecipients.map((recipient) => recipient.email),
      );

      try {
        await transport.send({
          toEmail,
          toName,
          subject: customerSubject,
          html: customerHtml,
          attachments: attachmentList,
        });

        for (const recipient of adminRecipients) {
          if (!recipient?.email) continue;
          await transport.send({
            toEmail: recipient.email,
            toName: recipient.name,
            subject: adminSubject,
            html: adminHtml,
            attachments: attachmentList,
          });
        }
      } finally {
        await fs.unlink(pdfAbsolutePath).catch(() => { });
      }
    }

  // ---------------------------------------------------------------------------
  // 2️⃣ Send Contact Form Email
  // ---------------------------------------------------------------------------
  async function sendContactEmail({ name, email, subject, message, orderId, country }) {
    const toEmail = process.env.OWNER_EMAIL;
    if (!toEmail) throw new Error("OWNER_EMAIL not configured");

    const { subject: subjectLine, html } = buildContactEmailTemplate({
      name,
      email,
      subject,
      message,
      orderId,
      country,
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



  // ---------------------------------------------------------------------------
  // 3 Send Shipping  Email
  // ---------------------------------------------------------------------------
  async function sendShippingEmail({ order }) {


  }
}