import os from "node:os";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
import { buildShippingNotificationTemplate } from "./templates/shippingTemplate.mjs";
import errors from "../../errors/errors.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const fallbackLogoPath = path.resolve(moduleDir, "./assets/logo.png");
const envLogoPath = (process.env.INVOICE_LOGO_PATH || "").trim();
const DEFAULT_LOGO_PATH = envLogoPath
  ? /^https?:\/\//i.test(envLogoPath)
    ? envLogoPath
    : path.isAbsolute(envLogoPath)
    ? envLogoPath
    : path.resolve(process.cwd(), envLogoPath)
  : fallbackLogoPath;


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
      logoPath = DEFAULT_LOGO_PATH,
    } = {}) {
      if (!order || typeof order !== "object") {
       return Promise.reject(errors.invalidData("sendOrderEmails requires an order object"));
      }

      const toEmail = order.email;
      const toName = order.name;

      if (!toEmail) {
       return Promise.reject(errors.invalidData("No email to send the order"))
      }

      const invoiceHtml = buildOrderInvoiceHtml({ order, orderId });
      const pdfFilename = `Invoice-${safeSlug(orderId || new Date().toISOString())}.pdf`;
      const tempPdfPath = path.join(os.tmpdir(), `invoice-${randomUUID()}.pdf`);

      let pdfAbsolutePath = tempPdfPath;
      let pdfBase64 = "";

      //Create PdfINvoice should do this try catch 
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

      const ownerEmail = normalizeEmail(process.env.OWNER_EMAIL);
      const forwardEmails = parseEmailList( process.env.ORDER_FORWARD_EMAILS);
      console.log("[emailService] ORDER_FORWARD_EMAILS raw:", process.env.ORDER_FORWARD_EMAILS);

      const adminRecipients = [];

      if(!ownerEmail){
        return Promise.reject(errors.invalidData(`No emails on the owner = ${ownerEmail}` ))
      }

      if(!forwardEmails){
        return Promise.reject(errors.invalidData(`No emails on the forward =${forwardEmails}` ))
      }
        adminRecipients.push({
          email: ownerEmail,
          name: "Ibogenics Admin & Logistics Team",
        });

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
      
      if(adminRecipients.length < 0)
        return Promise.reject(errors.internalError("Bad conversion on admin "))
      
      //Transport Should be the one to try catch
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

    if (!toEmail)
      return Promise.reject(errors.invalidData("OWNER_EMAIL not configured"));

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
  // 3. Send Shipping Notification Email
  // ---------------------------------------------------------------------------
  async function sendShippingEmail({
    order,
    orderId,
    orderDate,
    invoiceId,
    trackingNumber,
    trackingUrl,
    locale,
  } = {}) {
    if (!order || typeof order !== "object") {
      Promise.reject(errors.invalidData("sendShippingEmail requires an order object"))
    }

    const toEmail = process.env.TEST_RECIPIENT 
    const toName =  order.name

    if (!toEmail) {
     return Promise.reject(errors.invalidData("sendShippingEmail requires a recipient email address"))
    }

    const { subject, html } = buildShippingNotificationTemplate({
      order,
      orderId,
      orderDate,
      invoiceId,
      trackingNumber,
      trackingUrl,
      locale,
    });

    await transport.send({
      toEmail,
      toName,
      subject,
      html,
    });
  }
}
