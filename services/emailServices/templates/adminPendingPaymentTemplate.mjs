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
 * Build the admin notification email for manual orders
 * awaiting Wise / Revolut payment.
 */
export function buildAdminPendingPaymentTemplate({
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

  const subject = buildAdminPendingPaymentSubject({
    date: formattedDate,
    customerName,
    orderId: resolvedOrderId,
  });

  // ——— Items list + merchandise subtotal ———
  const items = Array.isArray(order?.items) ? order.items : [];
  let merchandiseSubtotalCents = 0;
  const itemsHtml = renderPackedItemsListWithSubtotal(items, currency, (lt) => {
    merchandiseSubtotalCents += lt;
  });

  // ——— Shipping ———
  const shippingCents = Number.isFinite(
    Number(order?.metadata?.shipping_cost_cents ?? order?.shipping_cost_cents)
  )
    ? Number(order?.metadata?.shipping_cost_cents ?? order?.shipping_cost_cents)
    : 0;
  const shippingCost = formatMoney(shippingCents, currency);

  // ——— Discount (if any) ———
  const disc = order?.metadata?.discount && typeof order.metadata.discount === "object"
    ? order.metadata.discount
    : null;

  const discountCode =
    typeof disc?.code === "string" && disc.code.trim() ? disc.code.trim() : "";

  const percentRaw = disc?.value ?? disc?.percent;
  const percent = Number.isFinite(Number(percentRaw))
    ? Math.max(0, Math.min(100, Math.trunc(Number(percentRaw))))
    : null;

  let discountCents = 0;
  if (percent && merchandiseSubtotalCents > 0) {
    discountCents = Math.floor((merchandiseSubtotalCents * percent) / 100);
  } else if (Number.isInteger(disc?.amount_cents) && disc.amount_cents > 0) {
    discountCents = disc.amount_cents;
  } else if (Number.isInteger(order?.amount_total)) {
    const derived = merchandiseSubtotalCents + shippingCents - order.amount_total;
    if (Number.isFinite(derived) && derived > 0) discountCents = Math.trunc(derived);
  }
  discountCents = Math.max(0, Math.min(discountCents, merchandiseSubtotalCents));

  const discountLineHtml = discountCents > 0
    ? `<p style="margin:4px 0;"><strong>Discount${discountCode ? ` (${escapeHtml(discountCode)})` : percent ? ` (${percent}%)` : ""}:</strong> -${escapeHtml(formatMoney(discountCents, currency))}</p>`
    : "";

  // ——— Totals ———
  const orderTotal = Number.isInteger(order?.amount_total)
    ? formatMoney(order.amount_total, currency)
    : formatMoney(
        Math.max(0, merchandiseSubtotalCents + shippingCents - discountCents),
        currency
      );

  const shippingHtml = renderAddressHtml(shippingAddress);
  const billingHtml = renderAddressHtml(billingAddress);

  return {
    subject,
    html: [
      '<div style="font-family:Helvetica,Arial,sans-serif;color:#222;font-size:14px;line-height:1.6;">',
      `  <h2 style="margin:0 0 16px 0;">A new Order awaiting payment — ${escapeHtml(customerName)}</h2>`,
      `  <p style="margin:0 0 8px 0;">Order ID <strong>${escapeHtml(resolvedOrderId || "")}</strong></p>`,
      `  <p style="margin:0 0 8px 0;">Received on ${escapeHtml(formattedDate)}</p>`,
      '  <p style="margin:16px 0;">Dear Ibogenics Admin &amp; Logistics Team,</p>',
      '  <p style="margin:0 0 16px 0;">A new order has been created and is currently <strong>awaiting payment confirmation</strong>. Please do not ship until payment has been verified.</p>',
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
      '  <p style="margin:24px 0 8px 0;"><strong>Products ordered</strong></p>',
      `  ${itemsHtml}`,
      `  <p style="margin:16px 0;"><strong>Shipping:</strong> ${escapeHtml(shippingCost)}</p>`,
      discountLineHtml,
      `  <p style="margin:0 0 16px 0;"><strong>Order total:</strong> ${escapeHtml(orderTotal)}</p>`,
      '  <p style="margin:32px 0 0 0; color:#b22222;"><strong>⚠️ Payment pending:</strong> Please verify receipt of Wise / Revolut transfer before preparing shipment.</p>',
      "  <p style=\"margin:32px 0 0 0;\">With gratitude,<br/><strong>The Ibogenics Team</strong><br/>" +
        '<a href="https://mesodose.com" style="color:#b87333;text-decoration:none;">www.mesodose.com</a></p>',
      "</div>",
    ].join("\n"),
  };
}

export function buildAdminPendingPaymentSubject({ date, customerName, orderId }) {
  const safeDate = normalizeString(date) || "today";
  const safeName = normalizeString(customerName) || "customer";
  const safeId = normalizeString(orderId) || "pending";
  return `Other Countries Order — ${safeName} (Order ${safeId}, ${safeDate})`;
}

// helper that also returns a subtotal via callback
function renderPackedItemsListWithSubtotal(items = [], currency = fallbackCurrency, onLineTotal = () => {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<p style="margin:0 0 16px 0;color:#555;">No items found.</p>';
  }
  const rows = items.map((item) => {
    const name = escapeHtml(normalizeString(item?.name) || "Item");
    const quantity = Number.isFinite(Number(item?.quantity))
      ? Math.max(1, Number(item.quantity))
      : 1;
    const lineTotalCents = Math.max(0, Number(item?.unit_amount || 0)) * quantity;
    onLineTotal(lineTotalCents);
    const lineTotal = formatMoney(lineTotalCents, currency);
    return `    <li style="margin:0 0 6px 0;">${name} &times; ${quantity} — ${lineTotal}</li>`;
  });
  return ['<ul style="margin:0 0 16px 16px;padding:0;">', ...rows, "</ul>"].join("\n");
}

export default {
  buildAdminPendingPaymentTemplate,
  buildAdminPendingPaymentSubject,
};
