import {
  defaultLocale,
  escapeHtml,
  fallbackCurrency,
  firstNonEmpty,
  formatMoney,
  formatOrderDate,
  normalizeString,
  renderAddressHtml,
  resolveAddress,
} from "./templateUtils.mjs";

/**
 * Build the internal notification email sent to Ibogenics admins.
 * Mirrors the layout requested by the operations team and highlights
 * all fulfilment details needed for packing.
 */
export function buildAdminNotificationTemplate({
  paymentType,
  order = {},
  orderId,
  orderDate,
  locale = defaultLocale,
} = {}) {
  const resolvedOrderId =
    normalizeString(orderId) ||
    normalizeString(order?.id) ||
    normalizeString(order?.metadata?.order_id) ||
    normalizeString(order?.payment_id);

  const customerName = firstNonEmpty(
    order?.name,
    order?.metadata?.shipping_address?.name,
    order?.metadata?.billing_address?.name,
    "Customer",
  );
  const formattedDate = formatOrderDate(
    orderDate || order?.metadata?.order_date || order?.created_at,
    locale,
  );
  const currency = String(order?.currency || fallbackCurrency).toUpperCase();

  const shippingAddress = resolveAddress(
    order?.metadata?.shipping_address,
    order?.shipping_address,
  );
  const billingAddress = resolveAddress(
    order?.metadata?.billing_address,
    order?.billing_address,
  );

  const contactPhone = firstNonEmpty(
    order?.phone,
    order?.metadata?.phone,
    shippingAddress.phone,
    order?.metadata?.billing_address?.phone,
  );
  const contactEmail = firstNonEmpty(order?.email, order?.metadata?.email);

  const subject = buildAdminNotificationSubject({
    paymentType,
    date: formattedDate,
    customerName,
    orderId: resolvedOrderId,
  });

  const itemsHtml = renderPackedItemsList(order?.items, currency);
  const orderTotal = formatMoney(order?.amount_total, currency);
  const shippingHtml = renderAddressHtml(shippingAddress);
  const billingHtml = renderAddressHtml(billingAddress);
  const shippingCents = Number.isFinite(
    Number(order?.metadata?.shipping_cost_cents ?? order?.shipping_cost_cents)
  )
    ? Number(order?.metadata?.shipping_cost_cents ?? order?.shipping_cost_cents)
    : 0;
  const shippingCost = formatMoney(shippingCents, currency);

  return {
    subject,
    html: [
      '<div style="font-family:Helvetica,Arial,sans-serif;color:#222;font-size:14px;line-height:1.6;">',
      `  <h2 style="margin:0 0 16px 0;">New order received on ${escapeHtml(formattedDate)} for ${escapeHtml(customerName)}</h2>`,
      `  <p style="margin:0 0 8px 0;">Order ID <strong>${escapeHtml(resolvedOrderId || "")}</strong></p>`,
      '  <p style="margin:0 0 16px 0;">Dear Ibogenics Admin &amp; Logistics Team,</p>',
      "  <p style=\"margin:0 0 16px 0;\">Please prepare the following package(s) for immediate shipping:</p>",
      "  <table style=\"margin:0 0 16px 0; font-size:14px;\">",
      "    <tr><td style=\"padding:0 12px 4px 0; color:#555;\">Client Name:</td><td><strong>" +
        escapeHtml(customerName) +
        "</strong></td></tr>",
      "    <tr><td style=\"padding:0 12px 4px 0; color:#555;\">Phone:</td><td>" +
        escapeHtml(contactPhone || "—") +
        "</td></tr>",
      "    <tr><td style=\"padding:0 12px 0 0; color:#555;\">Email:</td><td>" +
        escapeHtml(contactEmail || "—") +
        "</td></tr>",
      "  </table>",
      '  <p style="margin:24px 0 8px 0;"><strong>Shipping Address</strong></p>',
      `  <p style="margin:0 0 16px 0;">${shippingHtml}</p>`,
      '  <p style="margin:24px 0 8px 0;"><strong>Billing Address</strong></p>',
      `  <p style="margin:0 0 16px 0;">${billingHtml}</p>`,
      '  <p style="margin:24px 0 8px 0;"><strong>Products to pack</strong></p>',
      `  ${itemsHtml}`,
      `  <p style="margin:16px 0;"><strong>Shipping:</strong> ${escapeHtml(shippingCost)}</p>`,
      `  <p style="margin:0 0 16px 0;"><strong>Order total:</strong> ${escapeHtml(orderTotal)}</p>`,
      "  <p style=\"margin:32px 0 0 0;\">With gratitude,<br/><strong>The Ibogenics Team</strong><br/>" +
        '<a href="https://mesodose.com" style="color:#b87333;text-decoration:none;">www.mesodose.com</a></p>',
      "</div>",
    ].join("\n"),
  };
}

export function buildAdminNotificationSubject({paymentType, date, customerName, orderId }) {
  console.log("Payment_Type in email Subject",paymentType)
  const safeDate = normalizeString(date) || "today";
  const safeName = normalizeString(customerName) || "customer";
  const safeId = normalizeString(orderId) || "pending";
  return `Stripe/Manual - ${safeName} (Order ${safeId}, ${safeDate})`;
}

function renderPackedItemsList(items = [], currency = fallbackCurrency) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<p style="margin:0 0 16px 0;color:#555;">No items found.</p>';
  }

  const rows = items.map((item) => {
    const name = escapeHtml(normalizeString(item?.name) || "Item");
    const quantity = Number.isFinite(Number(item?.quantity))
      ? Math.max(1, Number(item.quantity))
      : 1;
    const lineTotal = formatMoney(Number(item?.unit_amount || 0) * quantity, currency);
    return `    <li style="margin:0 0 6px 0;">${name} &times; ${quantity} — ${lineTotal}</li>`;
  });

  return ['<ul style="margin:0 0 16px 16px;padding:0;">', ...rows, "</ul>"].join("\n");
}

export default {
  buildAdminNotificationTemplate,
  buildAdminNotificationSubject,
};
