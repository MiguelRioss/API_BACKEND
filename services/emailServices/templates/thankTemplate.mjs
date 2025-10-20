import {
  defaultLocale,
  escapeHtml,
  firstNonEmpty,
  formatMoney,
  formatOrderDate,
  normalizeString,
  renderAddressHtml,
  resolveAddress,
} from "./templateUtils.mjs";

/**
 * Build the detailed thank-you email template used after an order is created.
 * Returns both subject and HTML body so callers can wire it where needed.
 */
export function buildThankTemplate({
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
  const subject = buildThankTemplateSubject(resolvedOrderId);

  const customerName =
    normalizeString(order?.name) ||
    normalizeString(order?.metadata?.shipping_address?.name) ||
    "Customer";

  const shippingAddress = resolveAddress(
    order?.metadata?.shipping_address,
    order?.shipping_address,
  );
  const billingAddress = resolveAddress(
    order?.metadata?.billing_address,
    order?.billing_address,
  );

  const orderTotal = formatMoney(order?.amount_total, order?.currency);
  const shippingCents = Number.isFinite(
    Number(order?.metadata?.shipping_cost_cents ?? order?.shipping_cost_cents)
  )
    ? Number(order?.metadata?.shipping_cost_cents ?? order?.shipping_cost_cents)
    : 0;
  const shippingCost = formatMoney(shippingCents, order?.currency);
  const formattedDate = formatOrderDate(
    orderDate || order?.metadata?.order_date || order?.created_at,
    locale,
  );
  const mesoContactBaseUrl = "https://mesodose.com/mesocontact";
  const contactUrl = resolvedOrderId
    ? `${mesoContactBaseUrl}?orderId=${encodeURIComponent(resolvedOrderId)}`
    : mesoContactBaseUrl;
  const safeContactUrl = escapeHtml(contactUrl);

  const items = Array.isArray(order?.items) ? order.items : [];
  const itemsHtml = renderItemsList(items);
  const shippingHtml = renderAddressHtml(shippingAddress);
  const billingHtml = renderAddressHtml(billingAddress);

  const contactName =
    normalizeString(order?.name) ||
    shippingAddress.name ||
    billingAddress.name;
  const contactPhone = firstNonEmpty(
    order?.phone,
    shippingAddress.phone,
    billingAddress.phone,
    order?.metadata?.phone,
  );
  const contactEmail = firstNonEmpty(
    order?.email,
    order?.metadata?.email,
    billingAddress.email,
    shippingAddress.email,
  );

  return {
    subject,
    html: [
      '<div style="font-family:Helvetica,Arial,sans-serif;color:#222;font-size:14px;line-height:1.6;">',
      `  <p style="margin:0 0 16px 0;">Dear ${escapeHtml(customerName)},</p>`,
      "  <p style=\"margin:0 0 16px 0;\">",
      "    Thank you for your order with Mesodose. We have received your payment and your order is now being processed.",
      "  </p>",
      `  <p style="margin:0 0 8px 0;"><strong>Order date:</strong> ${escapeHtml(formattedDate)}</p>`,
      `  <p style="margin:0 0 8px 0;"><strong>Order ID:</strong> ${escapeHtml(resolvedOrderId || "")}</p>`,
      `  <p style="margin:0 0 8px 0;"><strong>Shipping:</strong> ${escapeHtml(shippingCost)}</p>`,
      `  <p style="margin:0 0 16px 0;"><strong>Order total:</strong> ${escapeHtml(orderTotal)}</p>`,
      '  <p style="margin:0 0 8px 0;"><strong>Items:</strong></p>',
      `  ${itemsHtml}`,
      `  <p style="margin:16px 0 8px 0;"><strong>Shipping to:</strong><br/>${shippingHtml}</p>`,
      `  <p style="margin:16px 0 8px 0;"><strong>Billing address:</strong><br/>${billingHtml}</p>`,
      "  <p style=\"margin:16px 0;\">",
      `    <strong>Name:</strong> ${escapeHtml(contactName)}<br/>`,
      `    <strong>Telephone:</strong> ${escapeHtml(contactPhone)}<br/>`,
      `    <strong>Email:</strong> ${escapeHtml(contactEmail)}`,
      "  </p>",
      "  <p style=\"margin:16px 0;\">",
      "    Your invoice is attached to this email.",
      "  </p>",
      "  <p style=\"margin:16px 0;\">",
      "    You will receive a separate email with your CTT (Portuguese postal service) tracking details as soon as your parcel is handed over to the carrier.",
      "  </p>",
      "  <p style=\"margin:16px 0;\">",
      `    If anything above needs correcting, please reply to this email before dispatch, or use our MesoContact form and quote your Order ID ${escapeHtml(
        resolvedOrderId || "",
      )}:`,
      `    <a href="${safeContactUrl}" style="color:#b87333;text-decoration:none;">${safeContactUrl}</a>`,
      "  </p>",
      "  <p style=\"margin:16px 0;\">",
      "    With gratitude,<br/>",
      "    <strong>The Ibogenics Team</strong><br/>",
      '    <a href="https://mesodose.com" style="color:#b87333;text-decoration:none;">www.mesodose.com</a>',
      "  </p>",
      "</div>",
    ].join("\n"),
  };
}

export function buildThankTemplateSubject(orderId) {
  const normalized = normalizeString(orderId);
  if (normalized) {
    return `Thank you for your order #${normalized} - invoice attached`;
  }
  return "Thank you for your order - invoice attached";
}

function renderItemsList(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<p style="margin:0 0 16px 0;color:#555;">No items available.</p>';
  }

  const rows = items.map((item) => {
    const name = escapeHtml(normalizeString(item?.name) || "Item");
    const quantity = Number.isFinite(Number(item?.quantity))
      ? Math.max(1, Number(item.quantity))
      : 1;
    return `    <li style="margin:0 0 6px 0;">${name} &times; ${quantity}</li>`;
  });

  return [
    '<ul style="margin:0 0 16px 16px;padding:0;">',
    ...rows,
    "</ul>",
  ].join("\n");
}

export default {
  buildThankTemplate,
  buildThankTemplateSubject,
};
