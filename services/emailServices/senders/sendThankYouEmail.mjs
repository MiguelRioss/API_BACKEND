import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { safeSlug } from "../utils/utils.mjs";
import { createPdfInvoice } from "../utils/pdfInvoice.mjs";
import { buildOrderInvoiceHtml } from "../templates/emailTemplates.mjs";
import { buildThankTemplate } from "../templates/thankTemplate.mjs";

export async function sendThankYouEmail({ transport, order, orderId, logoPath }) {
  const invoiceHtml = buildOrderInvoiceHtml({ order, orderId });
  const tempPdfPath = path.join(os.tmpdir(), `invoice-${randomUUID()}.pdf`);
  const pdfFilename = `Invoice-${safeSlug(orderId || new Date().toISOString())}.pdf`;

  const pdfAbsolutePath = await createPdfInvoice(invoiceHtml, logoPath, tempPdfPath);
  const pdfBuffer = await fs.readFile(pdfAbsolutePath);
  const pdfBase64 = pdfBuffer.toString("base64");

  const { subject, html } = buildThankTemplate({
    order,
    orderId,
    orderDate: order.createdAt || order.metadata?.order_date,
  });

  await transport.send({
    toEmail: order.email,
    toName: order.name,
    subject,
    html,
    attachments: [
      {
        filename: pdfFilename,
        content: pdfBase64,
        contentType: "application/pdf",
      },
    ],
  });

  await fs.unlink(pdfAbsolutePath).catch(() => {});
}
