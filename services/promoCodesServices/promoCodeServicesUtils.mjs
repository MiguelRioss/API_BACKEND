import errors from "../../errors/errors.mjs";
import { randomUUID } from "node:crypto";

export const PROMO_USAGE_TYPE = Object.freeze({
  SINGLE: "single",
  MULTIPLE: "multiple",
});

export async function validatePromoCodeObj(data) {
  const discountCode = data.promocode || data;

  const valCode = randomUUID();
  const createdDate = new Date();

  if (typeof discountCode !== "object" || discountCode === null) {
    return errors.invalidData("Invalid promo code object");
  }

  // ✅ Require name
  if (
    typeof discountCode.name !== "string" ||
    !discountCode.name.trim() ||
    discountCode.name.trim().length < 3
  ) {
    return errors.invalidData(
      "Invalid name: must be a non-empty string of at least 3 characters"
    );
  }
  const name = discountCode.name.trim().toUpperCase();

  // ✅ Require and validate daysValid (1–31)
  if (
    discountCode.daysValid === undefined ||
    isNaN(Number(discountCode.daysValid)) ||
    Number(discountCode.daysValid) <= 0 ||
    Number(discountCode.daysValid) > 31
  ) {
    return errors.invalidData(
      "Invalid daysValid: must be between 1 and 31 days"
    );
  }

  const daysValid = Number(discountCode.daysValid);

  // ✅ Calculate expiry date at 23:59:59 of the last valid day
  const expiryDate = new Date(createdDate);
  expiryDate.setDate(expiryDate.getDate() + daysValid);
  expiryDate.setHours(23, 59, 59, 999);

  // ✅ Validate discount percentage / value
  let pct = discountCode.discountPercentage ?? discountCode.value;
  if (pct !== undefined) {
    pct = Number(pct);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      return errors.invalidData(
        "Invalid discount percentage/value: must be between 1 and 100"
      );
    }
  }

  // ✅ Usage type enforcement
  const usageType =
    discountCode.usageType?.toLowerCase() || PROMO_USAGE_TYPE.SINGLE;
  if (!Object.values(PROMO_USAGE_TYPE).includes(usageType)) {
    return errors.invalidData(
      `Invalid usageType: must be '${PROMO_USAGE_TYPE.SINGLE}' or '${PROMO_USAGE_TYPE.MULTIPLE}'`
    );
  }


  return {
    ...discountCode,
    name,
    discountPercentage: pct,
    code: valCode,
    status: true,
    created: createdDate.toISOString(),
    expiryDate: expiryDate.toISOString(), // ← auto-calculated expiry
    daysValid,
    usageType,
  };
}
