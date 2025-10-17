

export const sanitizeAddress = (address = {}) => {
  if (!address || typeof address !== "object") {
    return { ...EMPTY_ADDRESS };
  }

  return {
    name: sanitizeString(address.name),
    line1: sanitizeString(address.line1),
    line2: sanitizeString(address.line2),
    city: sanitizeString(address.city),
    state: sanitizeString(address.state ?? address.region ?? address.province),
    postal_code: sanitizeString(address.postal_code ?? address.postalCode ?? address.zip),
    country: sanitizeString(address.country).toUpperCase(),
    phone: sanitizeString(address.phone),
  };
};

export const sanitizeString = (value) => (typeof value === "string" ? value.trim() : "");



export const toInteger = (value, fallback = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const int = Math.trunc(num);
  return int < 0 ? fallback : int;
};

export const pickNonEmpty = (...values) => {
  for (const value of values) {
    const trimmed = sanitizeString(value);
    if (trimmed) {
      return trimmed;
    }
  }
  return "";
};

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;