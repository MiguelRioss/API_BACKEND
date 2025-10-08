import os from "node:os";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { buildOrderInvoiceHtml, buildThankYouEmailHtml } from "./emailTemplates.mjs";
import { createPdfInvoice } from "./pdfInvoice.mjs";

const DEFAULT_LOGO_PATH = process.env.INVOICE_LOGO_PATH || "./assets/logo.png";


// -----------------------------------------------------------------------------
// Email Service Factory
// -----------------------------------------------------------------------------
export default function createEmailService({ transport } = {}) {
  if (!transport || typeof transport.send !== "function") {
    throw new Error("emailService expects a transport with a send() function");
  }

  return {
    sendOrderInvoiceEmail,
    sendContactEmail,
  };

  // ---------------------------------------------------------------------------
  // 1️⃣ Send Order Invoice Email
  // ---------------------------------------------------------------------------
  async function sendOrderInvoiceEmail({
    order,
    orderId,
    live = false,
    logoPath = DEFAULT_LOGO_PATH,
  } = {}) {
    if (!order || typeof order !== "object") {
      throw new Error("sendOrderInvoiceEmail requires an order object");
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

  // ---------------------------------------------------------------------------
  // 2️⃣ Send Contact Form Email
  // ---------------------------------------------------------------------------
  async function sendContactEmail({ name, email, subject, message, orderId, country }) {
    const toEmail = process.env.OWNER_EMAIL;
    if (!toEmail) throw new Error("OWNER_EMAIL not configured");

    const brandColor = "#b87333"; // Mesodose bronze
    const accentBg = "#fcfcf6";

    // Hosted logo (no attachments)

    const html = `
  <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:${accentBg};padding:40px 0;color:#222;font-size:15px;line-height:1.6;">
    <table width="600" align="center" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;box-shadow:0 2px 10px rgba(0,0,0,0.06);overflow:hidden;">
      <tr>
        <td style="background:${brandColor};text-align:center;padding:24px;">
        </td>
      </tr>

      <tr>
        <td style="padding:32px 40px;">
          <h2 style="margin:0;font-size:20px;color:#111;">New Contact Form Message</h2>
          <p style="margin-top:4px;font-size:14px;color:#555;">Received via <strong>MesoContact</strong> on ${new Date().toLocaleString()}</p>

          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;"/>

          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
            <tr><td width="150" style="color:#777;">Name:</td><td><strong>${escapeHtml(name || "—")}</strong></td></tr>
            <tr><td style="color:#777;">Email:</td><td><a href="mailto:${escapeHtml(
              email || ""
            )}" style="color:${brandColor};text-decoration:none;">${escapeHtml(email || "—")}</a></td></tr>
            <tr><td style="color:#777;">Country:</td><td>${escapeHtml(country || "—")}</td></tr>
            <tr><td style="color:#777;">Order ID:</td><td>${escapeHtml(orderId || "—")}</td></tr>
            <tr><td style="color:#777;">Subject:</td><td>${escapeHtml(subject || "—")}</td></tr>
          </table>

          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;"/>

          <p style="white-space:pre-wrap;font-size:15px;color:#222;">${escapeHtml(message || "")}</p>

          <hr style="border:none;border-top:1px solid #eee;margin:30px 0;"/>

          <p style="font-size:13px;color:#888;">
            You can reply directly to <strong>${escapeHtml(email)}</strong> to respond to this customer.
          </p>
        </td>
      </tr>

      <tr>
        <td style="background:#fafafa;text-align:center;padding:16px;font-size:12px;color:#999;">
          <p style="margin:0;">© ${new Date().getFullYear()} Mesodose. All rights reserved.</p>
          <p style="margin:4px 0 0;"><a href="https://mesodose.com" style="color:${brandColor};text-decoration:none;">www.mesodose.com</a></p>
        </td>
      </tr>
    </table>
  </div>
  `;

    const subjectLine = `[MesoContact] ${subject || "New Message"}`;

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
  // Helpers
  // ---------------------------------------------------------------------------
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
}
