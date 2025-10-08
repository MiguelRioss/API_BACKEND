// services/emailService.mjs
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { buildOrderInvoiceHtml, buildThankYouEmailHtml } from "./emailTemplates.mjs";
import { createPdfInvoice } from "./pdfInvoice.mjs";

const DEFAULT_LOGO_PATH = process.env.INVOICE_LOGO_PATH || "./assets/logo.png";

/**
 * High-level email service that builds + sends order invoices.
 * @param {object} deps
 * @param {{send:Function}} deps.transport - e.g., brevoTransport
 */
export default function createEmailService({ transport } = {}) {
  if (!transport || typeof transport.send !== "function") {
    throw new Error("emailService expects a transport with a send() function");
  }

  return { sendOrderInvoiceEmail , sendContactEmail };

  /**
   * Sends invoice to the buyer (or TEST_RECIPIENT in test mode), BCCs OWNER_EMAIL.
   * Generates a PDF, attaches it, and cleans up the temp file afterwards.
   * @param {object} params
   * @param {object} params.order - order payload from webhook
   * @param {string|number} [params.orderId] - internal order id to show
   * @param {boolean} [params.live=false] - Stripe live mode flag
   * @param {string} [params.logoPath] - override logo for PDF header
   */
  async function sendOrderInvoiceEmail({ order, orderId, live = false, logoPath = DEFAULT_LOGO_PATH } = {}) {
    if (!order || typeof order !== "object") {
      throw new Error("sendOrderInvoiceEmail requires an order object");
    }

    const isTestRoute = !live && !!process.env.TEST_RECIPIENT;
    const toEmail = isTestRoute ? process.env.TEST_RECIPIENT : order?.email;
    const toName = isTestRoute ? "Test Recipient" : (order?.name || "");
    if (!toEmail) {
      console.warn("[emailService] Skipping email send, no recipient available.");
      return;
    }

    const invoiceHtml = buildOrderInvoiceHtml({ order, orderId });
    const pdfFilename = `Invoice-${safeSlug(orderId || new Date().toISOString())}.pdf`;
    const tempPdfPath = path.join(os.tmpdir(), `invoice-${randomUUID()}.pdf`);

    let pdfAbsolutePath = tempPdfPath;
    try {
      pdfAbsolutePath = await createPdfInvoice(invoiceHtml, logoPath, tempPdfPath);
    } catch (err) {
      console.error("[emailService] Failed to generate PDF invoice:", err);
      throw err;
    }

    const html = buildThankYouEmailHtml({ order, orderId });
    const subject = buildSubject(orderId);

    try {
      await transport.send({
        toEmail,
        toName,
        subject,
        html,
        bcc: process.env.OWNER_EMAIL || undefined,
        attachments: [
          {
            filename: pdfFilename,
            path: pdfAbsolutePath,
            contentType: "application/pdf",
          },
        ],
      });
    } finally {
      await fs.unlink(pdfAbsolutePath).catch(() => {});
    }
  }
}



async function sendContactEmail({ name, email, subject, message, orderId, country }) {
  const toEmail = process.env.OWNER_EMAIL;
  if (!toEmail) throw new Error("OWNER_EMAIL not configured");

  const html = `
    <div style="font-family:Helvetica,Arial,sans-serif; line-height:1.6; color:#222; font-size:14px;">
      <h3 style="color:#111;">New message from MesoContact</h3>
      <p><strong>Name:</strong> ${escapeHtml(name || "")}</p>
      <p><strong>Email:</strong> ${escapeHtml(email || "")}</p>
      <p><strong>Country:</strong> ${escapeHtml(country || "")}</p>
      <p><strong>Order ID:</strong> ${escapeHtml(orderId || "")}</p>
      <p><strong>Subject:</strong> ${escapeHtml(subject || "—")}</p>
      <p style="margin-top:12px; white-space:pre-wrap;">${escapeHtml(message || "")}</p>
    </div>
  `;

  const subjectLine = `[MesoContact] ${subject || "New Message"}`;

  await transport.send({
    toEmail,
    toName: "Mesodose Team",
    subject: subjectLine,
    html,
    bcc: process.env.TEST_RECIPIENT || undefined,
  });
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


function buildSubject(orderId) {
  const suffix = orderId ? ` #${String(orderId).trim()}` : "";
  return `Thank you for your order${suffix}`;
}

function safeSlug(value) {
  return String(value || "order")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}
