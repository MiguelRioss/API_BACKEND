// services/emailTemplates.mjs

/**
 * Build a simple invoice HTML from an order payload.
 * @param {object} params
 * @param {object} params.order - order payload (name, email, amount_total, currency, items[], metadata/address)
 * @param {string|number} [params.orderId] - saved order id (fallback to session id)
 */
export function buildOrderInvoiceHtml({ order, orderId }) {
  const a = order?.metadata?.address || {};
  const addrHtml = [a.line1, a.line2, `${a.postal_code || ""} ${a.city || ""}`.trim(), a.country]
    .filter(Boolean)
    .join("<br/>");

  const money = (cents) =>
    `${(Number(cents || 0) / 100).toFixed(2)} ${String(order?.currency || "").toUpperCase()}`;

  return `
    <h2>Thank you for your order</h2>
    <p><b>Order:</b> ${orderId || order?.metadata?.stripe_session_id || "-"}</p>
    <p>
      <b>Name:</b> ${order?.name || "-"}<br/>
      <b>Email:</b> ${order?.email || "-"}<br/>
      <b>Phone:</b> ${order?.metadata?.phone || "-"}
    </p>
    ${addrHtml ? `<p><b>Address:</b><br/>${addrHtml}</p>` : ""}
    ${order?.metadata?.notes ? `<p><b>Notes:</b> ${order.metadata.notes}</p>` : ""}
    <hr/>
    <ul>
      ${(order?.items || [])
        .map((it) => `<li>${it.quantity} × ${it.name} — ${money(it.unit_amount)}</li>`)
        .join("")}
    </ul>
    <p style="margin-top:8px"><b>Total:</b> ${money(order?.amount_total)}</p>
  `;
}
