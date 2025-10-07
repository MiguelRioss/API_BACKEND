const fallbackCurrency = "EUR";

/**
 * Encode a string for safe HTML output.
 * We only allow a small whitelist of characters here to avoid messing up the email.
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Format cents into a human readable currency string.
 * Falls back to a simple amount + currency text if Intl fails.
 */
function formatMoney(amountCents = 0, currency = fallbackCurrency) {
  const amount = Number.isFinite(Number(amountCents)) ? Number(amountCents) / 100 : 0;
  const upperCurrency = String(currency || fallbackCurrency).toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: upperCurrency,
      currencyDisplay: "symbol",
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${upperCurrency}`;
  }
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Build the invoice HTML block that is injected into the styled PDF template.
 * This HTML is also handy if we ever want to send inline invoice copies.
 */
export function buildOrderInvoiceHtml({ order = {}, orderId } = {}) {
  const items = Array.isArray(order.items) ? order.items : [];
  const currency = String(order.currency || fallbackCurrency).toUpperCase();
  const customerName = escapeHtml(order.name || "Customer");
  const address = order?.metadata?.address || {};
  const addressLines = [
    address.line1,
    address.line2,
    `${address.postal_code || ""} ${address.city || ""}`.trim(),
    address.country,
  ]
    .map((line) => escapeHtml(line || ""))
    .filter(Boolean)
    .join("<br/>");

  const invoiceNumber = escapeHtml(orderId ? `#${orderId}` : "");

  const itemsMarkup = items.length
    ? items
        .map((item) => {
          const qty = Number(item.quantity) || 1;
          const itemTotal = Number(item.unit_amount || 0) * qty;
          const maybeQty = qty > 1 ? ` <span style="color:#666;">(x${qty})</span>` : "";
          return `
            <li>
              <span class="item-name">${escapeHtml(item.name || "Item")}${maybeQty}</span>
              <span class="item-amount">${formatMoney(itemTotal, currency)}</span>
            </li>
          `;
        })
        .join("")
    : `
      <li>
        <span class="item-name">Order summary</span>
        <span class="item-amount">${formatMoney(order.amount_total || 0, currency)}</span>
      </li>
    `;

  return `
    <section class="details">
      <h2>Invoice ${invoiceNumber}</h2>
      <p><strong>Date:</strong> ${formatDate()}</p>
      <p><strong>Billed to:</strong><br/>${customerName}${addressLines ? `<br/>${addressLines}` : ""}</p>
    </section>

    <ul class="line-items">
      ${itemsMarkup}
    </ul>

    <div class="total">
      <span>Total</span>
      <span>${formatMoney(order.amount_total || 0, currency)}</span>
    </div>
  `;
}

/**
 * Build a short thank-you email body for order confirmation.
 * @param {object} params
 * @param {object} params.order - order payload
 */
export function buildThankYouEmailHtml({ order = {} } = {}) {
  const customerName = escapeHtml(order.name || "Customer");
  const currency = String(order.currency || fallbackCurrency).toUpperCase();
  const total = formatMoney(order.amount_total || 0, currency);

  return `
    <div style="font-family:Helvetica,Arial,sans-serif; line-height:1.6; color:#222; font-size:14px;">
      <h2 style="color:#111;">Thank you for your order, ${customerName}!</h2>
      <p>
        We have received your order and it is now being processed.<br/>
        You will find your invoice attached to this email.
      </p>
      <p style="margin-top:12px;">
        <strong>Order total:</strong> ${total}
      </p>
      <p style="margin-top:20px;">
        With gratitude,<br/>
        <strong>The Ibogenics Team</strong><br/>
        <a href="https://mesodose.com" style="color:#b87333; text-decoration:none;">www.mesodose.com</a>
      </p>
    </div>
  `;
}

export default {
  buildOrderInvoiceHtml,
  buildThankYouEmailHtml,
};
