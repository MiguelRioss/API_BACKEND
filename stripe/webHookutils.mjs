const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitizeString = (value) => (typeof value === "string" ? value.trim() : "");

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const trimmed = sanitizeString(value);
    if (trimmed) {
      return trimmed;
    }
  }
  return "";
};

const firstValidEmail = (...values) => {
  for (const value of values) {
    const candidate = sanitizeString(value).toLowerCase();
    if (candidate && EMAIL_REGEX.test(candidate)) {
      return candidate;
    }
  }
  return "";
};

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
};

const toInteger = (value, fallback = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const int = Math.trunc(num);
  return int < 0 ? fallback : int;
};

const EMPTY_ADDRESS = {
  name: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
  phone: "",
};

const sanitizeAddress = (address = {}) => {
  if (!address || typeof address !== "object") {
    return { ...EMPTY_ADDRESS };
  }

  const source = address.address ? extractStripeAddress(address) : address;

  return {
    name: sanitizeString(source?.name),
    line1: sanitizeString(source?.line1),
    line2: sanitizeString(source?.line2),
    city: sanitizeString(source?.city),
    state: sanitizeString(source?.state ?? source?.region ?? source?.province),
    postal_code: sanitizeString(source?.postal_code ?? source?.postalCode ?? source?.zip),
    country: sanitizeString(source?.country).toUpperCase(),
    phone: sanitizeString(source?.phone),
  };
};

const extractStripeAddress = (details = {}) => {
  const addr = details?.address || {};
  return {
    name: details?.name ?? addr?.name ?? "",
    line1: addr?.line1 ?? "",
    line2: addr?.line2 ?? "",
    city: addr?.city ?? "",
    state: addr?.state ?? addr?.region ?? addr?.province ?? "",
    postal_code: addr?.postal_code ?? addr?.postalCode ?? "",
    country: addr?.country ?? "",
    phone: details?.phone ?? addr?.phone ?? "",
  };
};

const hasAddressData = (address = EMPTY_ADDRESS) =>
  Boolean(address.line1 || address.city || address.postal_code || address.country);

const parseAddressMeta = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (err) {
      return null;
    }
  }
  if (typeof value === "object") {
    return value;
  }
  return null;
};

const normalizeItem = (li) => {
  const quantity = Math.max(1, Math.trunc(Number(li?.quantity) || 1));
  const unitFromPrice = Number(li?.price?.unit_amount);
  const unitAmount = Number.isInteger(unitFromPrice)
    ? unitFromPrice
    : Math.round((Number(li?.amount_total) || 0) / quantity);

  const rawId =
    li?.price?.product?.metadata?.productId ??
    li?.price?.metadata?.productId ??
    li?.metadata?.productId ??
    null;
  if (rawId === "__shipping__") {
    return null;
  }
  const idNum = Number(rawId);
  const id = Number.isInteger(idNum) && idNum >= 0 ? idNum : null;

  const name = sanitizeString(li?.description || li?.price?.product?.name || "");

  return {
    id,
    name: name || "Item",
    quantity,
    unit_amount: Number.isInteger(unitAmount) ? unitAmount : 0,
  };
};

export function normalizeLineItems(lineItems = []) {
  return lineItems
    .map((li) => normalizeItem(li))
    .filter(Boolean);
}

export function normalizeLineItemsWithCatalog(lineItems = [], catalog = []) {
  const base = normalizeLineItems(lineItems);
  if (!Array.isArray(catalog) || catalog.length === 0) {
    return base;
  }

  const byName = new Map(
    catalog.map((product) => [sanitizeString(product.title || product.name).toLowerCase(), product])
  );

  return base.map((item) => {
    if (Number.isInteger(item.id)) {
      return item;
    }

    const guess = byName.get(item.name.toLowerCase());
    if (guess) {
      const guessId = Number(guess.id);
      if (Number.isInteger(guessId) && guessId >= 0) {
        return { ...item, id: guessId };
      }
    }
    return item;
  });
}

export function buildOrderPayload({ session, items }) {
  const meta = session?.metadata || {};

  const shippingCandidate =
    parseAddressMeta(meta.shipping_address) || extractStripeAddress(session?.shipping_details);
  const billingCandidate =
    parseAddressMeta(meta.billing_address) || extractStripeAddress(session?.customer_details);

  const shippingAddress = sanitizeAddress(shippingCandidate);
  let billingAddress = sanitizeAddress(billingCandidate);

  const billingSameAsShipping = toBoolean(meta.billing_same_as_shipping);
  if (billingSameAsShipping || !hasAddressData(billingAddress)) {
    billingAddress = { ...shippingAddress };
  }

  const name = firstNonEmpty(
    meta.full_name,
    meta.name,
    session?.customer_details?.name,
    shippingAddress.name,
    billingAddress.name,
  );
  const email = firstValidEmail(
    meta.email,
    session?.customer_email,
    session?.customer_details?.email,
  );
  const phone = firstNonEmpty(
    meta.phone,
    session?.customer_details?.phone,
  );

  if (!name) {
    throw new Error("Missing customer name in Stripe session metadata");
  }
  if (!email) {
    throw new Error("Missing customer email in Stripe session metadata");
  }
  if (!phone) {
    throw new Error("Missing customer phone in Stripe session metadata");
  }

  const shippingCost = toInteger(
    meta.shipping_cost_cents,
    Number(session?.total_details?.amount_shipping) || 0,
  );

  const normalizedClientReferenceId =
    sanitizeString(session?.client_reference_id) || sanitizeString(meta.client_reference_id);
  const normalizedOrderId =
    sanitizeString(meta.order_id) || normalizedClientReferenceId;
  const normalizedSessionId = sanitizeString(session?.id);

  const normalizedItems = (Array.isArray(items) ? items : []).map((item) => {
    const idNum = Number(item?.id);
    return {
      id: Number.isInteger(idNum) && idNum >= 0 ? idNum : NaN,
      name: sanitizeString(item?.name) || "Item",
      quantity: Math.max(1, Math.trunc(Number(item?.quantity) || 1)),
      unit_amount: Math.max(0, Math.trunc(Number(item?.unit_amount) || 0)),
    };
  });

  if (normalizedItems.length === 0) {
    throw new Error("Stripe session returned no line items");
  }

  if (normalizedItems.some((item) => !Number.isInteger(item.id))) {
    throw new Error("Unable to resolve product identifiers from Stripe session");
  }

  return {
    name,
    email,
    phone,
    amount_total: Number(session?.amount_total) || 0,
    currency: sanitizeString(session?.currency).toLowerCase() || "eur",
    items: normalizedItems,
    payment_id: sanitizeString(session?.payment_intent),
    session_id: normalizedSessionId,
    shipping_cost_cents: shippingCost,
    payment_status: sanitizeString(session?.payment_status).toLowerCase() === "paid",
    metadata: buildMetadata(),
  };

  function buildMetadata() {
    const metadata = {
      notes: sanitizeString(meta.notes),
      billing_same_as_shipping: billingSameAsShipping,
      shipping_cost_cents: shippingCost,
      shipping_address: { ...shippingAddress, phone },
      billing_address: { ...billingAddress, phone: billingAddress.phone || phone },
      stripe_session_id: normalizedSessionId,
    };

    if (normalizedClientReferenceId) {
      metadata.client_reference_id = normalizedClientReferenceId;
    }
    if (normalizedOrderId) {
      metadata.order_id = normalizedOrderId;
    }

    return metadata;
  }
}
