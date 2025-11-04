import { PROMO_USAGE_TYPE } from "../promoCodesServices/promoCodeServicesUtils.mjs";
import { randomUUID } from "node:crypto";

const ALLOWED_REASONS = new Set([
  "Poor audio/video quality",
  "Contains identifying or sensitive info",
  "Not relevant to prompt/guidelines",
  "Missing consent / rights to publish",
  "Length/format not suitable",
  "Other",
]);


/**
 * Create a promo Code for certain days.
 *
 * @param {Int} numberDays  - Number of days the code will be.
 * @returns {Promise<Object>} A discount object to create on database.
 */
export default function createPromoCodeForCertainTime(numberDays) {
  return {
    name: `CODE_GENERATED-${randomUUID()}`,
    daysValid: numberDays,
    discountPercentage: 10,
    type: PROMO_USAGE_TYPE.SINGLE,
  };
}


export default function ensureString(value, {
  name = "value",
  required = false,
  max = 500,
  allowEmpty = false,
  whitelist = ALLOWED_REASONS /* Set<string> | undefined */,
} = {}) {
  if (value == null) {
    if (required) throw errors.invalidData(`${name} is required`);
    return ""; // treat missing as empty when not required
  }

  if (typeof value !== "string") {
    // Reject non-strings to avoid surprises (arrays/objects/Buffers)
    throw errors.invalidData(`${name} must be a string`);
  }

  // Normalize: trim + collapse weird whitespace
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!allowEmpty && normalized.length === 0) {
    if (required) throw errors.invalidData(`${name} cannot be empty`);
    return "";
  }

  if (normalized.length > max) {
    throw errors.invalidData(`${name} exceeds max length (${max})`);
  }

  if (whitelist && !whitelist.has(normalized)) {
    throw errors.invalidData(`${name} must be one of the allowed values`);
  }

  // Optional: strip control chars (keep \n if you want multi-line notes)
  // return normalized.replace(/[\u0000-\u001F\u007F]/g, "");
  return normalized;
}
