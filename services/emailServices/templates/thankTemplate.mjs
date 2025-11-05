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

  // Totals
  const currency = order?.currency;
  const orderTotal = formatMoney(order?.amount_total, currency);

  const shippingCents = Number.isFinite(
    Number(order?.metadata?.shipping_cost_cents ?? order?.shipping_cost_cents)
  )
    ? Number(order?.metadata?.shipping_cost_cents ?? order?.shipping_cost_cents)
    : 0;
  const shippingCost = formatMoney(shippingCents, currency);

  const formattedDate = formatOrderDate(
    orderDate || order?.metadata?.order_date || order?.created_at,
    locale,
  );

  // Items list for the email body (names/quantities only)
  const items = Array.isArray(order?.items) ? order.items : [];

  // ─────────────────────────────────────────────────────────
  // Optional discount display
  // Source priority:
  //   1) order.metadata.discount.{code, percent, amount_cents}
  //   2) order.metadata.discount_percent / discount_amount_cents
  // If only percent is present, derive from merchandise subtotal (items only)
  //   using unit_amount*quantity when available.
  // ─────────────────────────────────────────────────────────
  const metaDiscObj =
    order?.metadata?.discount && typeof order.metadata.discount === "object"
      ? order.metadata.discount
      : undefined;

  const discountCode =
    (typeof metaDiscObj?.code === "string" && metaDiscObj.code.trim()) ||
    (typeof order?.metadata?.discount_code === "string" &&
      order.metadata.discount_code.trim()) ||
    undefined;

  const percentSrc =
    metaDiscObj?.percent ??
    order?.metadata?.discount_percent ??
    undefined;

  const amountCentsSrc =
    metaDiscObj?.amount_cents ??
    order?.metadata?.discount_amount_cents ??
    undefined;

  const discountPercent = Number.isFinite(Number(percentSrc))
    ? Math.max(0, Math.trunc(Number(percentSrc)))
    : undefined;

  let discountCents =
    Number.isInteger(amountCentsSrc) && amountCentsSrc >= 0 ? amountCentsSrc : undefined;

  // If amount not provided but percent is, try to compute from merchandise subtotal
  if (discountCents == null && discountPercent != null && Array.isArray(items) && items.length) {
    const merchandiseSubtotal = items.reduce((sum, it) => {
      const qty = Math.max(1, Math.trunc(Number(it?.quantity) || 1));
      const unit = Math.max(0, Math.trunc(Number(it?.unit_amount) || 0));
      return sum + qty * unit;
    }, 0);
    if (merchandiseSubtotal > 0) {
      discountCents = Math.floor((merchandiseSubtotal * discountPercent) / 100);
      // safety cap
      discountCents = Math.max(0, Math.min(discountCents, merchandiseSubtotal));
    }
  }

  const hasDiscount = Number.isInteger(discountCents) && discountCents > 0;
  const discountLabel = discountCode ? `Discount (${discountCode})` : "Discount";
  const formattedDiscount = hasDiscount ? formatMoney(discountCents, currency) : null;

  // Contact info
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

  // MesoContact link
  const mesoContactBaseUrl = "https://mesodose.com/mesocontact";
  const contactParams = [];
  if (resolvedOrderId) {
    contactParams.push(`orderId=${encodeURIComponent(resolvedOrderId)}`);
  }
  contactParams.push(`subject=${encodeURIComponent("Order support")}`);
  if (contactName) {
    contactParams.push(`name=${encodeURIComponent(contactName)}`);
  }
  if (contactEmail) {
    contactParams.push(`email=${encodeURIComponent(contactEmail)}`);
  }
  const contactUrl = `${mesoContactBaseUrl}?${contactParams.join("&")}`;
  const safeContactUrl = escapeHtml(contactUrl);

  const itemsHtml = renderItemsList(items);
  const shippingHtml = renderAddressHtml(shippingAddress);
  const billingHtml = renderAddressHtml(billingAddress);

  return {
    subject,
    html: [
      '<div style="font-family:Helvetica,Arial,sans-serif;color:#222;font-size:14px;line-height:1.6;">',
      `  <p style="margin:0 0 16px 0;">Dear ${escapeHtml(customerName)},</p>`,
      '  <p style="margin:0 0 16px 0;">Thank you for your order with Mesodose. We have received your payment and your order is now being processed.</p>',
      `  <p style="margin:0 0 8px 0;"><strong>Order date:</strong> ${escapeHtml(formattedDate)}</p>`,
      `  <p style="margin:0 0 8px 0;"><strong>Order ID:</strong> ${escapeHtml(resolvedOrderId || "")}</p>`,
      `  <p style="margin:0 0 8px 0;"><strong>Shipping:</strong> ${escapeHtml(shippingCost)}</p>`,
      hasDiscount
        ? `  <p style="margin:0 0 8px 0;"><strong>${escapeHtml(
            discountLabel
          )}:</strong> -${escapeHtml(formattedDiscount)}</p>`
        : "",
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
      "  <p style=\"margin:16px 0;\">Your invoice is attached to this email.</p>",
      "  <p style=\"margin:16px 0;\">You will receive a separate email with your CTT (Portuguese postal service) tracking details as soon as your parcel is handed over to the carrier.</p>",
      "  <p style=\"margin:16px 0;\">",
      `    If anything above needs correcting, please reply to this email before dispatch, or use our MesoContact form and quote your Order ID ${escapeHtml(
        resolvedOrderId || "",
      )}: <a href="${safeContactUrl}" style="color:#b87333;text-decoration:none;">${safeContactUrl}</a>`,
      "  </p>",
      "  <p style=\"margin:16px 0;\">With gratitude,<br/><strong>The Ibogenics Team</strong><br/><a href=\"https://mesodose.com\" style=\"color:#b87333;text-decoration:none;\">www.mesodose.com</a></p>",
      "</div>",
    ].join("\n"),
  };
}

export function buildThankTemplateSubject(orderId) {
  const normalized = normalizeString(orderId);
  if (normalized) {
    return `Thank you for your order ${normalized} - invoice attached`;
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
