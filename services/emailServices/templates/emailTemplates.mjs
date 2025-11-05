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
  const amount = Number.isFinite(Number(amountCents))
    ? Number(amountCents) / 100
    : 0;
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
  const invoiceNumber = escapeHtml(orderId ? `${orderId}` : "");

  // ---- Shipping (cents) ----------------------------------------------------
  const rawShipping =
    order?.shipping_cost_cents ??
    order?.metadata?.shipping_cost_cents ??
    order?.metadata?.shipping_cost ??
    0;
  const shippingCents = Number.isFinite(Number(rawShipping))
    ? Number(rawShipping)
    : 0;
  const shippingAmount = formatMoney(shippingCents, currency);

  // ---- Addresses -----------------------------------------------------------
  const shippingAddress = coalesceAddress(
    order?.metadata?.shipping_address,
    order?.shipping_address
  );
  const billingAddress = coalesceAddress(
    order?.metadata?.billing_address,
    order?.billing_address
  );

  // Fallback phone/email into addresses (optional)
  if (order?.metadata?.phone) {
    if (!billingAddress.phone) billingAddress.phone = order.metadata.phone;
    if (!shippingAddress.phone) shippingAddress.phone = order.metadata.phone;
  }
  if (order?.email) {
    if (!billingAddress.email) billingAddress.email = order.email;
    if (!shippingAddress.email) shippingAddress.email = order.email;
  }

  const legacyAddress = coalesceAddress(order?.metadata?.address);

  const addressBlocks = buildAddressBlocks({
    shipping: shippingAddress,
    billing: billingAddress,
    fallback: legacyAddress,
    customerName: order?.name,
    billingSameFlag: order?.metadata?.billing_same_as_shipping,
  });

  // ---- Items markup + merchandise subtotal ---------------------------------
  let merchandiseSubtotalCents = 0;
  const itemsMarkup = items.length
    ? items
        .map((item) => {
          const qty = Math.max(1, Number(item.quantity) || 1);
          const unit = Math.max(0, Number(item.unit_amount) || 0);
          const lineTotal = qty * unit;
          merchandiseSubtotalCents += lineTotal;
          const maybeQty =
            qty > 1 ? ` <span style="color:#666;">(x${qty})</span>` : "";
          return `
            <li>
              <span class="item-name">${escapeHtml(
                item.name || "Item"
              )}${maybeQty}</span>
              <span class="item-amount">${formatMoney(
                lineTotal,
                currency
              )}</span>
            </li>
          `;
        })
        .join("")
    : `
      <li>
        <span class="item-name">Order summary</span>
        <span class="item-amount">${formatMoney(
          order.amount_total || 0,
          currency
        )}</span>
      </li>
    `;

  // ---- Discount (from metadata) --------------------------------------------
  // Supports: { code, value } where value = percent,
  // or { code, percent }, or { amount_cents } fallback.
  const disc =
    order?.metadata?.discount && typeof order.metadata.discount === "object"
      ? order.metadata.discount
      : null;

  const discountCode =
    typeof disc?.code === "string" && disc.code.trim() ? disc.code.trim() : "";

  // prefer value (percent), then percent; clamp 0..100
  const percentRaw = disc?.value ?? disc?.percent;
  const percent = Number.isFinite(Number(percentRaw))
    ? Math.max(0, Math.min(100, Math.trunc(Number(percentRaw))))
    : null;

  // compute from percent on MERCH only; else fallback to amount_cents; else derive from totals
  let discountCents = 0;
  if (percent && merchandiseSubtotalCents > 0) {
    discountCents = Math.floor((merchandiseSubtotalCents * percent) / 100);
  } else if (Number.isInteger(disc?.amount_cents) && disc.amount_cents > 0) {
    discountCents = disc.amount_cents;
  } else if (
    Number.isInteger(order?.amount_total) &&
    (merchandiseSubtotalCents || shippingCents)
  ) {
    // derive if needed (tolerate rounding)
    const derived =
      merchandiseSubtotalCents + shippingCents - order.amount_total;
    if (Number.isFinite(derived) && derived > 0)
      discountCents = Math.trunc(derived);
  }
  // safety caps
  discountCents = Math.max(
    0,
    Math.min(discountCents, merchandiseSubtotalCents)
  );

  // Build optional discount line
  const discountLineMarkup =
    discountCents > 0
      ? `
      <li class="summary-line">
        <span class="item-name">
          Discount${
            discountCode
              ? ` (${escapeHtml(discountCode)})`
              : percent
              ? ` (${percent}% )`
              : ""
          }
        </span>
        <span class="item-amount">-${formatMoney(
          discountCents,
          currency
        )}</span>
      </li>`
      : "";

  // ---- Shipping line --------------------------------------------------------
  const shippingLineMarkup = `
      <li class="summary-line">
        <span class="item-name">Shipping</span>
        <span class="item-amount">${shippingAmount}</span>
      </li>
    `;

  // ---- Total (use server-computed amount_total) ----------------------------
  const finalTotalCents = Number.isInteger(order.amount_total)
    ? order.amount_total
    : Math.max(0, merchandiseSubtotalCents + shippingCents - discountCents);

  return `
    <section class="details">
      <h2>Invoice ${invoiceNumber}</h2>
      <p><strong>Date:</strong> ${formatDate()}</p>
      ${addressBlocks}
    </section>

    <ul class="line-items">
      ${itemsMarkup}
      ${discountLineMarkup}
      ${shippingLineMarkup}
    </ul>

    <div class="total">
      <span>Total</span>
      <span>${formatMoney(finalTotalCents, currency)}</span>
    </div>
  `;
}

export default {
  buildOrderInvoiceHtml,
};

function buildAddressBlocks({
  shipping,
  billing,
  fallback,
  customerName,
  billingSameFlag,
}) {
  const shippingHas = hasAddress(shipping);
  const billingHas = hasAddress(billing);
  const fallbackHas = hasAddress(fallback);
  const billingSame = normalizeBoolean(billingSameFlag);

  const sections = [];
  const seenContacts = createSeenContacts();

  if (shippingHas && billingHas) {
    const treatAsSame = billingSame || addressesEqual(shipping, billing);
    if (treatAsSame) {
      sections.push({
        label: "Billing & Shipping",
        address: withFallbackName(shipping, customerName),
      });
    } else {
      sections.push({
        label: "Shipping address",
        address: withFallbackName(shipping, customerName),
      });
      sections.push({
        label: "Billing address",
        address: withFallbackName(billing, customerName),
      });
    }
  } else if (shippingHas) {
    sections.push({
      label: "Shipping address",
      address: withFallbackName(shipping, customerName),
    });
    if (fallbackHas && !addressesEqual(shipping, fallback)) {
      sections.push({
        label: "Billing address",
        address: withFallbackName(fallback, customerName),
      });
    }
  } else if (billingHas) {
    sections.push({
      label: "Billing address",
      address: withFallbackName(billing, customerName),
    });
  } else if (fallbackHas) {
    sections.push({
      label: "Billing address",
      address: withFallbackName(fallback, customerName),
    });
  } else {
    const safeName = escapeHtml(customerName || "Customer");
    sections.push({
      label: "Billing contact",
      address: { lines: [safeName] },
    });
  }

  const blocks = sections
    .map(({ label, address }) =>
      renderAddressBlock(label, address, seenContacts)
    )
    .join("");

  return `<div class="addresses">${blocks}</div>`;
}

function renderAddressBlock(
  label,
  address = {},
  seenContacts = createSeenContacts()
) {
  const safeLabel = escapeHtml(label);
  const lines = Array.isArray(address.lines)
    ? address.lines
    : buildAddressLines(address, seenContacts);

  const lineMarkup = lines.join("<br/>");

  return `
    <div class="address-block">
      <h3>${safeLabel}</h3>
      <p>${lineMarkup}</p>
    </div>
  `;
}

function buildAddressLines(address = {}, seenContacts = createSeenContacts()) {
  const lines = [];
  const name = escapeHtml(address.name || "");
  if (name) lines.push(`<strong>${name}</strong>`);

  if (address.company) lines.push(escapeHtml(address.company));
  if (address.line1) lines.push(escapeHtml(address.line1));
  if (address.line2) lines.push(escapeHtml(address.line2));

  const cityParts = [];
  if (address.postal_code) cityParts.push(escapeHtml(address.postal_code));
  if (address.city) cityParts.push(escapeHtml(address.city));
  if (cityParts.length) lines.push(cityParts.join(" "));

  if (address.state) lines.push(escapeHtml(address.state));
  if (address.country) lines.push(escapeHtml(address.country));

  // ✅ New: include phone and email if present
  const normalizedPhone = normalizeString(address.phone);
  if (normalizedPhone) {
    const phoneKey = normalizedPhone.replace(/\s+/g, "");
    if (!seenContacts.phones.has(phoneKey)) {
      lines.push(
        `<span style="color:#666;">Phone: ${escapeHtml(normalizedPhone)}</span>`
      );
      seenContacts.phones.add(phoneKey);
    }
  }

  const normalizedEmailRaw = normalizeString(address.email);
  const normalizedEmail = normalizedEmailRaw.toLowerCase();
  if (normalizedEmail) {
    if (!seenContacts.emails.has(normalizedEmail)) {
      lines.push(
        `<span style="color:#666;">Email: ${escapeHtml(
          normalizedEmailRaw
        )}</span>`
      );
      seenContacts.emails.add(normalizedEmail);
    }
  }

  return lines.length ? lines : [escapeHtml(address.fallback || "")];
}

function hasAddress(address) {
  if (!address) return false;
  const keys = ["line1", "line2", "city", "state", "postal_code", "country"];
  return keys.some((key) => {
    const value = address[key];
    return value != null && String(value).trim() !== "";
  });
}

function addressesEqual(a = {}, b = {}) {
  const keys = [
    "name",
    "line1",
    "line2",
    "city",
    "state",
    "postal_code",
    "country",
    "phone",
  ];
  return keys.every(
    (key) => normalizeString(a[key]) === normalizeString(b[key])
  );
}

function withFallbackName(address = {}, fallbackName = "") {
  const clone = { ...(address || {}) };
  if (!clone.name && fallbackName) clone.name = normalizeString(fallbackName);
  return clone;
}

function createSeenContacts() {
  return {
    phones: new Set(),
    emails: new Set(),
  };
}

function coalesceAddress(...candidates) {
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      return {
        name: normalizeString(candidate.name),
        company: normalizeString(candidate.company),
        line1: normalizeString(candidate.line1),
        line2: normalizeString(candidate.line2),
        city: normalizeString(candidate.city),
        state: normalizeString(candidate.state),
        postal_code: normalizeString(candidate.postal_code),
        country: normalizeString(candidate.country),
        phone: normalizeString(candidate.phone),
        email: normalizeString(candidate.email), // ✅ include email
      };
    }
  }
  return {
    name: "",
    company: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    phone: "",
    email: "", // ✅ empty fallback
  };
}

function normalizeString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    return lower === "true" || lower === "1" || lower === "yes";
  }
  return false;
}
