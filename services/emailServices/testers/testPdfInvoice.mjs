import path from "path";
import { fileURLToPath } from "url";
import { buildOrderInvoiceHtml } from "./emailTemplates.mjs";
import { createPdfInvoice } from "../pdfInvoice.mjs";

const order = {
  name: "Jane Doe",
  email: "jane@example.com",
  amount_total: 12900,
  currency: "eur",
  metadata: {
    billing_same_as_shipping: false,
    phone: "+351912345678",
    shipping_address: {
      name: "Jane Doe",
      line1: "Rua das Flores 10",
      city: "Lisboa",
      postal_code: "1100-001",
      country: "Portugal",
      phone: "+351912345678",
    },
    billing_address: {
      name: "Jane Doe",
      line1: "Rua das Limeiras 22",
      city: "Porto",
      postal_code: "4000-100",
      country: "Portugal",
    },
    address: {
      line1: "Rua das Flores 10",
      city: "Lisboa",
      postal_code: "1100-001",
      country: "Portugal",
    },
  },
  items: [
    { name: "Ibogenics Tincture TA", quantity: 1, unit_amount: 8900 },
    { name: "Mad Honey Drops", quantity: 1, unit_amount: 4000 },
  ],
};

const html = buildOrderInvoiceHtml({ order, orderId: "ORDER-TEST-001" });

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const logoPath = path.resolve(currentDir, "assets/logo.png");

createPdfInvoice(html, logoPath).then((generatedPath) => {
  console.log(`PDF generated at: ${generatedPath}`);
});
