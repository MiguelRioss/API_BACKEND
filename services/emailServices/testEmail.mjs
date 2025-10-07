// scripts/testEmail.mjs
import createEmailService from "../services/emailService.mjs";
import brevoTransport from "../services/transports/brevoTransport.mjs";

const emailService = createEmailService({ transport: brevoTransport });

const fakeOrder = {
  name: "Test User",
  email: process.env.TEST_RECIPIENT || "you@example.com",
  amount_total: 12345,
  currency: "eur",
  items: [{ name: "Ibotincture™ CLARA (60 ml)", quantity: 1, unit_amount: 12345 }],
  metadata: {
    address: { line1: "Rua X", city: "Lisboa", postal_code: "1000-000", country: "PT" },
  },
};

await emailService.sendOrderInvoiceEmail({ order: fakeOrder, orderId: 999, live: false });
console.log("Sent!");