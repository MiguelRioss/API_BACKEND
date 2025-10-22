import errors from "../../errors/errors.mjs";
import { randomUUID } from "node:crypto";

export default function createPromoCodeServices(db) {
  if (!db) {
    throw errors.internalError("Services dependency invalid");
  }

  return { createPromoCode, getPromoCodes };

  async function createPromoCode(discount) {
    console.log(discount);
    if (Number.isNaN(discount)) throw errors.invalidData("Invalid discount");

    return {
      discount,
      promoCode: randomUUID(),
    };
  }

  async function getPromoCodes() {
    if (typeof db.getPromoCodes !== "function") {
      throw errors.internalError("Promo code DB adapter missing getPromoCodes");
    }

    return db.getPromoCodes();
  }
}
