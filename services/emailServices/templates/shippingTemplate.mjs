import {
  defaultLocale,
  escapeHtml,
  firstNonEmpty,
  formatOrderDate,
  normalizeString,
  resolveAddress,
} from "./templateUtils.mjs";


import dotenv from "dotenv";

/**
 * Build the customer-facing shipping confirmation email template.
 * Returns both the subject and rendered HTML body.
 */
export function buildShippingNotificationTemplate({
  order = {},
  orderId,
  orderDate,
  invoiceId,
  trackingNumber,
  trackingUrl,
  locale = defaultLocale,
} = {}) {
  const resolvedOrderId =
    normalizeString(orderId) ||
    normalizeString(order?.id) ||
    normalizeString(order?.metadata?.order_id) ||
    normalizeString(order?.payment_id);

  const subject = buildShippingNotificationSubject(resolvedOrderId);

  const formattedDate = formatOrderDate(
    orderDate || order?.metadata?.order_date || order?.created_at,
    locale,
  );

  const mesoContactBaseUrl = "https://mesodose.com/mesocontact";
  const contactUrl = resolvedOrderId
    ? `${mesoContactBaseUrl}?orderId=${encodeURIComponent(resolvedOrderId)}`
    : mesoContactBaseUrl;
  const safeContactUrl = escapeHtml(contactUrl);

  const customerName = firstNonEmpty(
    order?.name,
    order?.metadata?.shipping_address?.name,
    order?.metadata?.billing_address?.name,
    "Customer",
  );

  const shippingAddress = resolveAddress(
    order?.metadata?.shipping_address,
    order?.shipping_address,
  );

  const items = Array.isArray(order?.items)
    ? order.items
    : Array.isArray(order?.products)
    ? order.products
    : [];
  const itemsHtml = renderShippingItemsList(items);
  const shippingAddressHtml = renderPlainAddressHtml(shippingAddress);

  const resolvedTrackingNumber = firstNonEmpty(
    trackingNumber,
    order?.tracking_number,
    order?.trackingNumber,
    order?.metadata?.tracking_number,
    order?.metadata?.trackingNumber,
    order?.metadata?.tracking?.number,
    order?.metadata?.track_number,
  );

  const resolvedTrackingUrl = firstNonEmpty(
    trackingUrl,
    order?.tracking_url,
    order?.track_url,
    order?.metadata?.tracking_url,
    order?.metadata?.trackingUrl,
    order?.metadata?.tracking?.url,
    order?.metadata?.tracking?.link,
  );

  const trackingNumberDisplay = resolvedTrackingNumber || "Will be shared shortly";

  const trackingLinkHtml = resolvedTrackingUrl
    ? `<a href="${escapeHtml(resolvedTrackingUrl)}" style="color:#b87333;text-decoration:none;">${escapeHtml(
        resolvedTrackingUrl,
      )}</a>`
    : "We will email your tracking link shortly.";

  return {
    subject,
    html: [
      '<div style="font-family:Helvetica,Arial,sans-serif;color:#222;font-size:14px;line-height:1.6;">',
      `  <p style="margin:0 0 8px 0;"><strong>Order date:</strong> ${escapeHtml(formattedDate)}</p>`,
      `  <p style="margin:0 0 8px 0;"><strong>Order ID:</strong> ${escapeHtml(resolvedOrderId || "")}</p>`,
      `  <p style="margin:0 0 16px 0;">Dear ${escapeHtml(customerName)},</p>`,
      "  <p style=\"margin:0 0 16px 0;\">Once again thank you for your order with Mesodose. To recap...</p>",
      '  <p style="margin:16px 0 8px 0;"><strong>Items you have ordered:</strong></p>',
      `  ${itemsHtml}`,
      '  <p style="margin:24px 0 8px 0;"><strong>We’ve shipped your order to:</strong></p>',
      `  <p style="margin:0 0 16px 0;">${shippingAddressHtml}</p>`,
      `  <p style="margin:0 0 8px 0;"><strong>Tracking:</strong> ${escapeHtml(trackingNumberDisplay)}</p>`,
      `  <p style="margin:0 0 16px 0;"><strong>Track here:</strong> ${trackingLinkHtml}</p>`,
      "  <p style=\"margin:16px 0;\">We use discreet, plain packaging and ship the goods as Berberine Tinctures.</p>",
      `  <p style="margin:16px 0;">If you have any questions or issues, please use our MesoContact form and quote your Order ID ${escapeHtml(
        resolvedOrderId || "",
      )}: <a href="${safeContactUrl}" style="color:#b87333;text-decoration:none;">${safeContactUrl}</a>.</p>`,
      "  <p style=\"margin:16px 0;\">Share the love – please don’t forget to rate us on TrustPilot 😊 " +
        '<a href="https://www.trustpilot.com/evaluate/ibogenics.com" style="color:#b87333;text-decoration:none;">https://www.trustpilot.com/evaluate/ibogenics.com</a></p>',
      "  <p style=\"margin:24px 0 0 0;\">With gratitude,<br/><strong>The Ibogenics Team</strong><br/>" +
        '<a href="https://mesodose.com" style="color:#b87333;text-decoration:none;">www.mesodose.com</a></p>',
      "</div>",
    ].join("\n"),
  };
}

export function buildShippingNotificationSubject(orderId) {
  const safeId = normalizeString(orderId);
  if (safeId) {
    return `Your Mesodose order #${safeId} has shipped — tracking inside`;
  }
  return "Your Mesodose order has shipped — tracking inside";
}

function renderShippingItemsList(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<p style="margin:0 0 16px 0;color:#555;">No items found.</p>';
  }

  const rows = items.map((item) => {
    const name = escapeHtml(normalizeString(item?.name) || "Item");
    const quantity = Number.isFinite(Number(item?.quantity))
      ? Math.max(1, Number(item.quantity))
      : 1;
    return `    <li style="margin:0 0 6px 0;">${name} &times; ${quantity}</li>`;
  });

  return ['<ul style="margin:0 0 16px 16px;padding:0;">', ...rows, "</ul>"].join("\n");
}

function renderPlainAddressHtml(address = {}) {
  const lines = [];
  if (address.name) lines.push(address.name);
  if (address.company) lines.push(address.company);
  if (address.line1) lines.push(address.line1);
  if (address.line2) lines.push(address.line2);

  const locality = [];
  if (address.city) locality.push(address.city);
  const regionPostal = [];
  if (address.state) regionPostal.push(address.state);
  if (address.postal_code) regionPostal.push(address.postal_code);

  if (locality.length && regionPostal.length) {
    lines.push(`${locality.join(", ")} ${regionPostal.join(" ")}`.trim());
  } else if (locality.length) {
    lines.push(locality.join(", "));
  } else if (regionPostal.length) {
    lines.push(regionPostal.join(" "));
  }

  if (address.country) lines.push(address.country);

  if (!lines.length) {
    return "&nbsp;";
  }

  return lines.map((line) => escapeHtml(line)).join("<br/>");
}

export default {
  buildShippingNotificationTemplate,
  buildShippingNotificationSubject,
};
