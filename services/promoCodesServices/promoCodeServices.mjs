import errors from "../../errors/errors.mjs";
import { randomUUID } from "node:crypto";

export default function createPromoCodeServices(db) {
    if (!db) {
        throw errors.internalError("Services dependency invalid");
    }

    return { createPromoCode, getPromoCodes, updatePromoCode };

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

    /**
 * Patch (partial update) existing promo code.
 * Only applies provided fields; preserves everything else.
 *
 * @param {string} id - Promo code ID
 * @param {Object} updates - Key/value pairs to patch
 * @returns {Promise<Object>} - Updated promo code
 */
    async function patchPromoCodeDB(id, updates) {
        ensureInitDb();
        if (!useRealtimeDB()) {
            return Promise.reject(
                errors.externalService("Firestore patch not implemented yet")
            );
        }

        if (!updates || typeof updates !== "object") {
            return Promise.reject(errors.invalidData("Invalid update payload"));
        }

        const db = getRealtimeDB();
        const ref = db.ref(`/promoCodes/${id}`);

        const snap = await ref.once("value");
        if (!snap.exists()) {
            return Promise.reject(errors.notFound(`Promo code "${id}" not found`));
        }

        await ref.update(updates);
        const newData = { ...(snap.val() || {}), ...updates };
        return { id, ...newData };
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
