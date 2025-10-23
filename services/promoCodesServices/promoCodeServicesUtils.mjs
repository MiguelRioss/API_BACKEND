import errors from "../../errors/errors.mjs";
import { randomUUID } from "node:crypto";

// 🔐 Enum-style constant to enforce valid types
export const PROMO_USAGE_TYPE = Object.freeze({
  SINGLE: "single",
  MULTIPLE: "multiple",
});

export async function validatePromoCodeObj(discountCode) {
  const valCode = randomUUID();
  const createdDate = new Date();

  if (typeof discountCode !== "object" || discountCode === null) {
    throw errors.invalidData("Invalid promo code object");
  }

  // ✅ Validate expiry date
  if (discountCode.expiryDate) {
    const expiry = new Date(discountCode.expiryDate);
    if (isNaN(expiry.getTime())) {
      throw errors.invalidData("Invalid expiryDate format");
    }
    if (expiry <= createdDate) {
      throw errors.invalidData("Expiry date must be in the future");
    }
  }

  // ✅ Validate discount percentage
  if (discountCode.discountPercentage !== undefined) {
    const pct = Number(discountCode.discountPercentage);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      throw errors.invalidData("Invalid discountPercentage: must be between 1 and 100");
    }
  }

  // ✅ Enforce usage type from constant object
  const usageType =
    discountCode.usageType?.toLowerCase() || PROMO_USAGE_TYPE.SINGLE;

  if (!Object.values(PROMO_USAGE_TYPE).includes(usageType)) {
    throw errors.invalidData(
      `Invalid usageType: must be '${PROMO_USAGE_TYPE.SINGLE}' or '${PROMO_USAGE_TYPE.MULTIPLE}'`
    );
  }

  // ✅ Optional usageLimit for multiple-use codes
  let usageLimit = null;
  if (usageType === PROMO_USAGE_TYPE.MULTIPLE) {
    if (discountCode.usageLimit !== undefined) {
      const limit = Number(discountCode.usageLimit);
      if (isNaN(limit) || limit <= 0) {
        throw errors.invalidData("Invalid usageLimit: must be a positive number");
      }
      usageLimit = limit;
    }
  }

  return {
    ...discountCode,
    code: valCode,
    status: true,
    created: createdDate.toISOString(),
    usageType,
    usageLimit,
  };
}
