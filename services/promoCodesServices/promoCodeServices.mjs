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
        const promoCodeObj = {
            ...discount,
            code: randomUUID(),
            status: true,
            created: new Date().toISOString(),
        };

        return await db.createPromoCodeDB(promoCodeObj);
    }

    async function getPromoCodes() {
        if (typeof db.getPromoCodes !== "function") {
            throw errors.internalError("Promo code DB adapter missing getPromoCodes");
        }
        console.log("Fetching promo codes from DB", await db.getPromoCodes());
        return await db.getPromoCodes();
    }
}
