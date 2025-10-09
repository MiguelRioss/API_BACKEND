export const fallbackCurrency = "EUR";
export const defaultLocale = "en-GB";

export function normalizeString(value) {
  if (value == null) return "";
  return String(value).trim();
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) return normalized;
  }
  return "";
}

export function formatMoney(amountCents = 0, currency = fallbackCurrency) {
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

export function formatOrderDate(value, locale = defaultLocale) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date());
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function resolveAddress(...candidates) {
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      return {
        name: normalizeString(candidate.name),
        company: normalizeString(candidate.company),
        line1: normalizeString(candidate.line1),
        line2: normalizeString(candidate.line2),
        city: normalizeString(candidate.city),
        state: normalizeString(candidate.state || candidate.region || candidate.province),
        postal_code: normalizeString(
          candidate.postal_code || candidate.postalCode || candidate.zip,
        ),
        country: normalizeString(candidate.country).toUpperCase(),
        phone: normalizeString(candidate.phone),
        email: normalizeString(candidate.email),
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
    email: "",
  };
}

export function renderAddressHtml(address = {}) {
  const lines = [];
  if (address.name) lines.push(`<strong>${escapeHtml(address.name)}</strong>`);
  if (address.company) lines.push(escapeHtml(address.company));
  if (address.line1) lines.push(escapeHtml(address.line1));
  if (address.line2) lines.push(escapeHtml(address.line2));

  const cityParts = [];
  if (address.city) cityParts.push(escapeHtml(address.city));
  const regionPostal = [];
  if (address.state) regionPostal.push(escapeHtml(address.state));
  if (address.postal_code) regionPostal.push(escapeHtml(address.postal_code));

  if (cityParts.length && regionPostal.length) {
    lines.push(`${cityParts.join(", ")} ${regionPostal.join(" ")}`.trim());
  } else if (cityParts.length) {
    lines.push(cityParts.join(", "));
  } else if (regionPostal.length) {
    lines.push(regionPostal.join(" "));
  }

  if (address.country) lines.push(escapeHtml(address.country));

  return lines.length ? lines.join("<br/>") : "&nbsp;";
}
