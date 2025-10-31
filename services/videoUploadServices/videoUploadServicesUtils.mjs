import { PROMO_USAGE_TYPE } from "../promoCodesServices/promoCodeServicesUtils.mjs";
import { randomUUID } from "node:crypto";

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
