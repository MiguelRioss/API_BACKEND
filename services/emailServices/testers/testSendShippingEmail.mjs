import "dotenv/config";
import brevoTransport from "../brevoTransports.mjs";
import createEmailService from "../emailService.mjs";
import { buildShippingNotificationTemplate } from "../templates/shippingTemplate.mjs";



const emailService = createEmailService({ transport: brevoTransport });

async function main() {
  try {
    const order = {
      name: "Jane Doe",
      email: "miguelangelorios5f@gmail.com",
      amount_total: 12900,
      currency: "EUR",
      items: [
        { name: "Ibogenics Tincture TA", quantity: 1 },
        { name: "Mad Honey Drops", quantity: 1 },
      ],
      metadata: {
        shipping_address: {
          name: "Jane Doe",
          line1: "Rua das Flores 10",
          city: "Lisboa",
          postal_code: "1100-001",
          country: "Portugal",
        },
      },
    };

    // Build your HTML + subject from the shipping template
    const { subject, html } = buildShippingNotificationTemplate({
      order,
      orderId: "ORDER-TEST-SHIP-001",
      orderDate: new Date().toISOString(),
      invoiceId: "INV-TEST-001",
      trackingNumber: "LX123456789PT",
      trackingUrl:
        "https://www.ctt.pt/feapl_2/app/open/objectSearch/objectSearch.jspx?lang=01",
    });

    // Send the email using Brevo adapter
    await brevoTransport.send({
      toEmail: order.email,
      toName: order.name,
      subject,
      html,
    });

    console.log("✅ Shipping notification test email sent successfully!");
  } catch (err) {
    console.error("❌ Shipping test email failed:", err);
  }
}

main();
