// services/emailServices/testSendEmail.mjs
import brevoTransport from "./brevoTransports.mjs";
import createEmailService from "./emailService.mjs";

const emailService = createEmailService({ transport: brevoTransport });

async function main() {
  try {
    const order = {
      name: "Jane Doe",
      email: "miguelangelorios5f@gmail.com", // replace with your email for manual testing
      amount_total: 12900, // cents
      currency: "EUR",
      items: [
        { name: "Ibogenics Tincture TA", quantity: 1, unit_amount: 8900 },
        { name: "Mad Honey Drops", quantity: 1, unit_amount: 4000 },
      ],
      metadata: {
        address: {
          line1: "Rua das Flores 10",
          city: "Lisboa",
          postal_code: "1100-001",
          country: "Portugal",
        },
      },
    };

    await emailService.sendOrderInvoiceEmail({
      order,
      orderId: "ORDER-TEST-001",
      live: false,
    });

    console.log("Test email triggered successfully.");
  } catch (err) {
    console.error("Test email failed:", err.message);
  }
}

main();
