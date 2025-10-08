import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

import path from "node:path";
import { buildLogoSrc } from "./utils.mjs";

const DEFAULT_INVOICE_LOGO_PATH = process.env.INVOICE_LOGO_PATH || "./assets/logo.png";

/**
 * Create a styled PDF invoice from HTML and company logo (Ibogenics theme)
 * @param {string} html - main invoice HTML from buildOrderInvoiceHtml()
 * @param {string} logoPath - local or remote image path
 * @param {string} [outputPath="./invoice.pdf"]
 * @returns {Promise<string>} - absolute path to generated PDF
 */
export async function createPdfInvoice(
  html,
  logoPath = DEFAULT_INVOICE_LOGO_PATH,
  outputPath = "./invoice.pdf"
) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  const page = await browser.newPage();
  const logoSrc = await buildLogoSrc(logoPath);

  const styledHtml = `
  <html>
    <head>
      <style>
        @page {
          margin: 25mm;
        }

        body {
          font-family: "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
          font-size: 13.5px;
          color: #1a1a1a;
          margin: 0;
          padding: 0;
          line-height: 1.7;
        }

        header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          border-bottom: 1.5px solid #b87333; /* bronze accent */
          padding-bottom: 20px;
          margin-bottom: 45px;
        }

        header img {
          height: 90px;  /* slightly larger logo */
          object-fit: contain;
        }

        header .company-info {
          text-align: right;
          font-size: 12px;
          color: #444;
          line-height: 1.6;
          margin-top: 10px;
        }

        h2 {
          font-family: "Georgia", serif;
          font-size: 20px;
          color: #111;
          margin-bottom: 8px;
        }

        .invoice-body {
          margin-top: 12px;
          line-height: 1.75;
        }

        .addresses {
          display: flex;
          flex-wrap: wrap;
          gap: 24px;
          margin-top: 18px;
        }

        .address-block {
          flex: 1 1 220px;
          min-width: 220px;
        }

        .address-block h3 {
          margin: 0 0 6px;
          font-size: 13px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #555;
        }

        .address-block p {
          margin: 0;
          line-height: 1.6;
        }

        .details p {
          margin: 6px 0;
        }

        ul {
          list-style: none;
          padding-left: 0;
          margin-top: 16px;
          border-top: 1px solid #ddd;
          border-bottom: 1px solid #ddd;
          padding: 14px 0;
        }

        ul li {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          font-size: 13.5px;
        }

        .item-name {
          flex: 1;
          color: #333;
        }

        .item-amount {
          width: 100px;
          text-align: right;
          color: #555;
        }

        .total {
          margin-top: 28px;
          font-size: 15px;
          font-weight: bold;
          display: flex;
          justify-content: space-between;
          border-top: 2px solid #111;
          padding-top: 14px;
        }

        footer {
          border-top: 1px solid #eee;
          margin-top: 55px;
          padding-top: 14px;
          font-size: 11.5px;
          color: #b87333;
          text-align: center;
          font-family: "Georgia", serif;
          letter-spacing: 0.25px;
        }
      </style>
    </head>

    <body>
      <header>
        <img src="${logoSrc}" alt="Ibogenics Logo"/>
        <div class="company-info">
          <strong>Ibogenics Ltd</strong><br/>
          www.mesodose.com<br/>
          info@ibogenics.com
        </div>
      </header>

      <section class="invoice-body">
        ${html}
      </section>

      <footer>
        &copy; ${new Date().getFullYear()} Ibogenics Ltd - All rights reserved
      </footer>
    </body>
  </html>`;

  await page.setContent(styledHtml, { waitUntil: "load" });
  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: { top: "25mm", bottom: "25mm" },
  });

  await browser.close();
  return path.resolve(outputPath);
}


/**
 * Detect MIME type from file extension
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "image/png";
  }
}
