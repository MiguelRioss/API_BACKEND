import "dotenv/config";
import brevoTransport from "../brevoTransports.mjs";
import createEmailService from "../emailService.mjs";

const emailService = createEmailService({ transport: brevoTransport });

async function main() {
  const order = {
    name: "Jane Doe",
    email: process.env.TEMPLATE_PREVIEW_EMAIL || "preview@example.com",
    amount_total: 13900,
    currency: "EUR",
    items: [
      { name: "Ibogenics Tincture TA", quantity: 1, unit_amount: 8900 },
      { name: "Mad Honey Drops", quantity: 1, unit_amount: 4000 },
    ],
    metadata: {
      billing_same_as_shipping: false,
      shipping_cost_cents: 1000,
      shipping_address: {
        name: "Jane Doe",
        line1: "Rua das Flores 10",
        city: "Lisboa",
        postal_code: "1100-001",
        country: "Portugal",
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
  };

  try {
    await emailService.sendOtherCountryEmails({
      order,
      orderId: "ORDER-TEST-001",
      live: false,
    });

    console.log("[testOtherCountrysTemplate] Preview email request submitted.");
  } catch (err) {
    console.error(
      "[testOtherCountrysTemplate] Failed to send preview:",
      err?.message || err,
    );
    process.exitCode = 1;
  }
}

main();
