import errors from "../../errors/errors.mjs";
import { randomUUID } from "node:crypto";
import { validatePromoCodeObj } from "./promoCodeServicesUtils.mjs";
export default function createPromoCodeServices(db) {
    if (!db) {
        throw errors.internalError("Services dependency invalid");
    }

    return { createPromoCode, getPromoCodes, updatePromoCode };

    async function createPromoCode(discount) {
        console.log(discount);
        const promoCodeObjValidated = await validatePromoCodeObj(discount);
       

        return await db.createPromoCodeDB(promoCodeObjValidated);
    }

    async function getPromoCodes() {
        if (typeof db.getPromoCodes !== "function") {
            throw errors.internalError("Promo code DB adapter missing getPromoCodes");
        }
        console.log("Fetching promo codes from DB", await db.getPromoCodes());
        return await db.getPromoCodes();
    }
    /**
   * Patch existing promo code by ID.
   * Only applies fields that already exist in the stored object.
   *
   * @param {string} id - Promo code ID
   * @param {Object} changes - Partial object with updated fields
   * @returns {Promise<Object>} - Updated promo code
   */
    async function updatePromoCode(id, changes) {
        if (!id || typeof id !== "string") {
            throw errors.invalidData("Invalid promo code ID");
        }
        if (!changes || typeof changes !== "object") {
            throw errors.invalidData("Invalid changes object");
        }

        // Get current promo code to know which keys are valid
        const existing = await db.getPromoCodeById(id);
        if (!existing) throw errors.notFound(`Promo code ${id} not found`);

        // Filter only fields that exist in the original object
        const allowed = {};
        for (const key of Object.keys(changes)) {
            if (key in existing) {
                allowed[key] = changes[key];
            }
        }

        if (!Object.keys(allowed).length) {
            throw errors.invalidData("No valid fields to update");
        }

        // Pass filtered changes to DB layer (patch)
        const updated = await db.patchPromoCodeDB(id, allowed);
        return updated;
    }
}
