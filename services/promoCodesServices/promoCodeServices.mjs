import errors from "../../errors/errors.mjs";
import { validatePromoCodeObjAndCreateCode } from "./promoCodeServicesUtils.mjs";

export default function createPromoCodeServices(db) {
  if (!db) {
    throw errors.internalError("Services dependency invalid");
  }

  return {
    createPromoCode,
    getPromoCodes,
    updatePromoCode,
    validatePromocode, // <-- NEW
  };

  async function createPromoCode(promoCodeObj) {
    console.log("🎟️ Incoming promoCodeObj:", promoCodeObj);
    try {
      const promoCodeObjValidated = await validatePromoCodeObjAndCreateCode(
        promoCodeObj
      );
      if (!promoCodeObjValidated) return null;
      const result = await db.createPromoCodeDB(promoCodeObjValidated);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async function getPromoCodes() {
    if (typeof db.getPromoCodes !== "function") {
      throw errors.internalError("Promo code DB adapter missing getPromoCodes");
    }
    return await db.getPromoCodes();
  }

  /**
   * Patch existing promo code by ID.
   * Only applies fields that already exist in the stored object.
   */
  async function updatePromoCode(id, changes) {
    if (!id || typeof id !== "string") {
      throw errors.invalidData("Invalid promo code ID");
    }
    if (!changes || typeof changes !== "object") {
      throw errors.invalidData("Invalid changes object");
    }

    const existing = await db.getPromoCodeById(id);
    if (!existing) throw errors.notFound(`Promo code ${id} not found`);

    // Filter to fields that exist on the stored record; DB layer also re-validates.
    const allowed = {};
    for (const key of Object.keys(changes)) {
      if (key in existing) {
        allowed[key] = changes[key];
      }
    }
    if (!Object.keys(allowed).length) {
      throw errors.invalidData("No valid fields to update");
    }

    const updated = await db.patchPromoCodeDB(id, allowed);
    return updated;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // NEW: Validate + touch a promo code by (code, discountPercent)
  // ───────────────────────────────────────────────────────────────────────────
  async function validatePromocode(code, discountPercent) {
    const normCode = String(code || "").trim();
    const normPercent = Number.isFinite(Number(discountPercent))
      ? Math.trunc(Number(discountPercent))
      : null;

    if (!normCode) throw errors.invalidData("Promo code is required");

    // 1) Lookup by code (prefer direct DB method; fallback to in-memory scan)
    let promo = null;
    const all = await getPromoCodes();
    promo = Array.isArray(all)
      ? all.find((p) => String(p.code).trim() === normCode)
      : null;
    if (!promo) throw errors.notFound(`Promo code ${normCode} not found`);

    // 2) Basic validity gates (only enforced if fields exist on record)
    if ("active" in promo && promo.active === false) {
      throw errors.forbidden("Promo code is inactive");
    }

    if ("expiresAt" in promo && promo.expiresAt) {
      const expiresAtMs = new Date(promo.expiresAt).getTime();
      if (Number.isFinite(expiresAtMs) && Date.now() > expiresAtMs) {
        throw errors.forbidden("Promo code has expired");
      }
    }

    // 3) Percent match (only if the record stores a percent)
    let storedPercent = null;
    for (const k of ["percent", "percentage", "discountPercent"]) {
      if (k in promo && Number.isFinite(Number(promo[k]))) {
        storedPercent = Math.trunc(Number(promo[k]));
        break;
      }
    }
    if (
      storedPercent != null &&
      normPercent != null &&
      storedPercent !== normPercent
    ) {
      throw errors.invalidData(
        `Promo code ${normCode} does not match percent ${normPercent}`
      );
    }
    const changes = {
      status: false,
    };

    // 5) Persist and return the updated promo
    const updated = await updatePromoCode(String(promo.id), changes);
    return updated;
  }
}
