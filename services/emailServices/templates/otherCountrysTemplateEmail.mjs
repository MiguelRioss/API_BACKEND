import {
  escapeHtml,
  firstNonEmpty,
  formatMoney,
  normalizeString,
} from "./templateUtils.mjs";

/**
 * Build the fallback payment instructions email for customers in countries
 * where Stripe checkout is unavailable. Accepts optional overrides for pricing
 * and links so operations can adjust the message without editing the markup.
 */
export function buildOtherCountrysTemplateEmail({
  order,
  orderId,
  customerName,
  items,
  productName = "Ibotincture TA",
  bottleSize = "60ml",
  priceCents = 30000,
  shippingCents = 1000,
  currency = "EUR",
  wiseUrl = "https://wise.com/pay/me/alvaronigelgiovanniz",
  revolutUrl = "https://revolut.me/alvaro9dt1",
} = {}) {
  const normalizedOrderId = normalizeString(
    orderId ||
      order?.id ||
      order?.metadata?.order_id ||
      order?.metadata?.client_reference_id,
  );
  const plainName = firstNonEmpty(
    normalizeString(customerName),
    normalizeString(order?.name),
    normalizeString(order?.metadata?.shipping_address?.name),
    "Customer",
  );
  const safeName = escapeHtml(plainName);

  const resolvedCurrency = normalizeString(order?.currency) || currency || "EUR";

  const normalizedItems = buildItemSummaries({
    order,
    items,
    productName,
    bottleSize,
    priceCents,
    currency: resolvedCurrency,
  });

  const resolvedShippingCents = resolveShippingCents(order, shippingCents);
  const itemsTotalCents = normalizedItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const computedTotalCents = resolveOrderTotal({
    order,
    itemsTotalCents,
    shippingCents: resolvedShippingCents,
  });

  const formattedShipping = formatMoneyHtml(resolvedShippingCents, resolvedCurrency);
  const formattedTotal = formatMoneyHtml(computedTotalCents, resolvedCurrency);

  const safeWiseUrl = escapeHtml(firstNonEmpty(wiseUrl, ""));
  const safeRevolutUrl = escapeHtml(firstNonEmpty(revolutUrl, ""));

  const subject = normalizedOrderId
    ? `Ibotincture Order & Payment Instructions (Order ${escapeSubject(normalizedOrderId)})`
    : "Ibotincture Order & Payment Instructions";

  const htmlSections = [
    '<div style="font-family:Helvetica,Arial,sans-serif;color:#222;font-size:14px;line-height:1.6;">',
    `  <p style="margin:0 0 16px 0;">Dear ${safeName},</p>`,
    '  <p style="margin:0 0 16px 0;">Thank you for your enquiry.</p>',
  ];

  if (normalizedOrderId) {
    htmlSections.push(
      `  <p style="margin:0 0 16px 0;"><strong>Order ID:</strong> ${escapeHtml(normalizedOrderId)}</p>`,
    );
  }

  htmlSections.push(
    '  <h2 style="margin:24px 0 8px 0;font-size:18px;color:#111;">Product &amp; Pricing</h2>',
    '  <ul style="margin:0 0 16px 20px;padding:0;">',
    ...normalizedItems.map(
      (item) =>
        `    <li>${item.quantity} &times; ${escapeHtml(item.name)} &mdash; ${formatMoneyHtml(item.lineTotalCents, resolvedCurrency)}</li>`,
    ),
    resolvedShippingCents > 0
      ? `    <li>Shipping &mdash; ${formattedShipping}</li>`
      : "",
    `    <li><strong>Total due:</strong> ${formattedTotal}</li>`,
    "  </ul>",
    '  <h2 style="margin:24px 0 8px 0;font-size:18px;color:#111;">Payment Options</h2>',
    "  <p style=\"margin:0 0 16px 0;\">",
    "    As Stripe does not allow us to process orders from certain countries, please use one of",
    "    the alternative payment methods below if your country is not listed at checkout.",
    "  </p>",
    '  <ul style="margin:0 0 16px 20px;padding:0;">',
    safeWiseUrl
      ? `    <li>Wise: <a href="${safeWiseUrl}" style="color:#b87333;text-decoration:none;">${safeWiseUrl}</a></li>`
      : "    <li>Wise payment link available upon request.</li>",
    safeRevolutUrl
      ? `    <li>Revolut: <a href="${safeRevolutUrl}" style="color:#b87333;text-decoration:none;">${safeRevolutUrl}</a></li>`
      : "    <li>Revolut payment link available upon request.</li>",
    "  </ul>",
    '  <p style="margin:16px 0;">Important: When you send your payment, please also email us the details below (even if supplied before):</p>',
    '  <ul style="margin:0 0 16px 20px;padding:0;">',
    "    <li>Full name</li>",
    "    <li>Full address</li>",
    "    <li>Country</li>",
    "    <li>Phone number</li>",
    "    <li>Email address</li>",
    "    <li>Copy of the payment receipt</li>",
    "  </ul>",
    '  <h2 style="margin:24px 0 8px 0;font-size:18px;color:#111;">Shipping Notice</h2>',
    "  <p style=\"margin:0 0 16px 0;\">",
    "    Please confirm with us before ordering if you are unsure whether we can ship to your country.",
    "    We cannot guarantee delivery into regions where Iboga or Ibogaine products are restricted or illegal.",
    "  </p>",
    '  <p style="margin:0 0 16px 0;font-weight:bold;">We do not ship to the USA.</p>',
    '  <h2 style="margin:24px 0 8px 0;font-size:18px;color:#111;">Health &amp; Safety Warnings</h2>',
    '  <ul style="margin:0 0 16px 20px;padding:0;">',
    "    <li>Not for detox purposes</li>",
    "    <li>Do not use if you are taking SSRIs</li>",
    "    <li>Do not use if you are taking antipsychotics</li>",
    "    <li>Do not use if you have known heart conditions</li>",
    "  </ul>",
    '  <h2 style="margin:24px 0 8px 0;font-size:18px;color:#111;">Disclaimer</h2>',
    "  <p style=\"margin:0 0 16px 0;\">",
    "    We cannot guarantee delivery into countries where Ibogaine is regulated or prohibited.",
    "    Customers are responsible for ensuring that import of this product is legal in their jurisdiction.",
    "  </p>",
    "  <p style=\"margin:24px 0 8px 0;\">Kind regards,</p>",
    "  <p style=\"margin:0 0 16px 0; line-height:1.5;\">",
    "    Al Ziani<br/>",
    "    IBOGENICS&reg;<br/>",
    "    Mobile (PT): +351 965 751 649",
    "  </p>",
    "</div>"
  );

  const html = htmlSections.filter(Boolean).join("\n");

  const textLines = [
    `Dear ${plainName},`,
    "",
    "Thank you for your enquiry.",
    "",
    "Product & Pricing",
    ...normalizedItems.map(
      (item) => `- ${item.quantity} x ${item.name} — ${formatMoneyPlain(item.lineTotalCents, resolvedCurrency)}`,
    ),
    resolvedShippingCents > 0
      ? `- Shipping — ${formatMoneyPlain(resolvedShippingCents, resolvedCurrency)}`
      : "- Shipping — included",
    `- Total due: ${formatMoneyPlain(computedTotalCents, resolvedCurrency)}`,
    "",
    "Payment Options",
    "As Stripe does not allow us to process orders from certain countries, please use one of the alternative methods below if your country is not listed at checkout.",
    safeWiseUrl ? `- Wise: ${wiseUrl}` : "- Wise payment link available upon request.",
    safeRevolutUrl ? `- Revolut: ${revolutUrl}` : "- Revolut payment link available upon request.",
    "",
    "Important: When you send your payment, please also email us the details below (even if supplied before):",
    "- Full name",
    "- Full address",
    "- Country",
    "- Phone number",
    "- Email address",
    "- Copy of the payment receipt",
    "",
    "Shipping Notice",
    "Please confirm with us before ordering if you are unsure whether we can ship to your country.",
    "We cannot guarantee delivery into regions where Iboga or Ibogaine products are restricted or illegal.",
    "We do not ship to the USA.",
    "",
    "Health & Safety Warnings",
    "- Not for detox purposes",
    "- Do not use if you are taking SSRIs",
    "- Do not use if you are taking antipsychotics",
    "- Do not use if you have known heart conditions",
    "",
    "Disclaimer",
    "We cannot guarantee delivery into countries where Ibogaine is regulated or prohibited.",
    "Customers are responsible for ensuring that import of this product is legal in their jurisdiction.",
    "",
    "Kind regards,",
    "Al Ziani",
    "IBOGENICS (R)",
    "Mobile (PT): +351 965 751 649",
  ];

  if (normalizedOrderId) {
    textLines.splice(3, 0, `Order ID: ${normalizedOrderId}`, "");
  }

  const text = textLines.join("\n");

  return {
    subject,
    html,
    text,
  };
}

export default {
  buildOtherCountrysTemplateEmail,
};

function buildItemSummaries({
  order,
  items,
  productName,
  bottleSize,
  priceCents,
  currency,
}) {
  const orderItems = Array.isArray(order?.items) ? order.items : null;
  const inputItems = Array.isArray(items) ? items : null;

  const sourceItems = orderItems && orderItems.length
    ? orderItems
    : inputItems && inputItems.length
    ? inputItems
    : [
        {
          name: `${bottleSize} ${productName}`.trim(),
          quantity: 1,
          unit_amount: priceCents,
        },
      ];

  return sourceItems.map((item) => {
    const name = firstNonEmpty(
      normalizeString(item?.name),
      `${bottleSize} ${productName}`.trim(),
      "Item",
    );
    const quantityRaw = Number(item?.quantity);
    const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.trunc(quantityRaw) : 1;

    const unitCandidates = [
      item?.unit_amount,
      item?.unitAmount,
      item?.price_cents,
      item?.price,
    ];
    const resolvedUnitAmount = unitCandidates.find((value) => Number.isFinite(Number(value)));
    const unitAmountCents = Math.max(0, Math.trunc(Number(resolvedUnitAmount ?? 0)));
    const totalCandidates = [
      item?.line_total_cents,
      item?.amount_total,
      item?.total,
    ];
    const resolvedTotal = totalCandidates.find((value) => Number.isFinite(Number(value)));
    const lineTotalCents =
      resolvedTotal != null
        ? Math.max(0, Math.trunc(Number(resolvedTotal)))
        : unitAmountCents * quantity;

    return {
      name,
      quantity,
      unitAmountCents,
      lineTotalCents,
      currency,
    };
  });
}

function resolveShippingCents(order, fallback) {
  const shippingCandidates = [
    order?.metadata?.shipping_cost_cents,
    order?.metadata?.shipping_cost,
    order?.shipping_cost_cents,
    order?.shipping_cost,
    order?.total_details?.amount_shipping,
    fallback,
  ];

  for (const candidate of shippingCandidates) {
    const num = Number(candidate);
    if (Number.isFinite(num) && num >= 0) {
      return Math.trunc(num);
    }
  }

  return 0;
}

function resolveOrderTotal({ order, itemsTotalCents, shippingCents }) {
  const candidates = [
    order?.amount_total,
    order?.total_cents,
    order?.metadata?.amount_total,
    itemsTotalCents + shippingCents,
  ];

  for (const candidate of candidates) {
    const num = Number(candidate);
    if (Number.isFinite(num) && num >= 0) {
      return Math.trunc(num);
    }
  }

  return Math.max(0, Math.trunc(itemsTotalCents + shippingCents));
}

function formatMoneyHtml(amountCents, currency) {
  const formatted = formatMoney(amountCents, currency);
  return escapeHtml(formatted).replace(/\u20ac/g, "&euro;");
}

function formatMoneyPlain(amountCents, currency) {
  return formatMoney(amountCents, currency);
}

function escapeSubject(value) {
  return String(value).replace(/[\r\n]+/g, " ").trim();
}
