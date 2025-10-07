// utils/stripe/normalizeLineItems.mjs

/**
 * Convert Stripe Checkout line_items into your internal item shape.
 * Expects line items from:
 *   stripe.checkout.sessions.listLineItems(sessionId, { expand: ["data.price","data.price.product"] })
 *
 * Output shape:
 *   { id: number|string, name: string, quantity: number, unit_amount: number }[]
 *
 * @param {Array<Object>} lineItems - Stripe line items (expanded)
 * @returns {Array<Object>}
 */
/**
 * Convert Stripe Checkout line_items into your internal item shape.
 * Expects:
 *   stripe.checkout.sessions.listLineItems(sessionId, { expand: ["data.price","data.price.product"] })
 */
export function normalizeLineItems(lineItems = []) {
    return lineItems.map((li) => {
        const qty = Number(li.quantity) || 1;
        const lineTotal = Number(li.amount_total) || 0;
        const unitAmount = Math.round(lineTotal / Math.max(qty, 1));

        // Prefer product metadata.productId, fallback to price metadata
        const rawId =
            li?.price?.product?.metadata?.productId ??
            li?.price?.metadata?.productId;

        // Only keep positive numeric IDs as numbers; otherwise preserve as empty string
        const asNum = Number(rawId);
        const internalId =
            Number.isFinite(asNum) && asNum > 0
                ? asNum
                : (rawId != null && String(rawId).trim() !== "" ? String(rawId) : "");

        return {
            id: internalId, // number (positive) or "" if unknown
            name: li?.description || li?.price?.product?.name || "Item",
            quantity: qty,
            unit_amount: unitAmount, // in cents
        };
    });
}

/**
 * Optional: fallback by product name when metadata is missing (useful for Stripe CLI fixtures).
 */
export function normalizeLineItemsWithCatalog(lineItems = [], catalog = []) {
    const byName = new Map(
        catalog.map((p) => [String(p.title || p.name || "").toLowerCase(), p])
    );

    return normalizeLineItems(lineItems).map((it) => {
        const idIsMissing =
            it.id === "" || it.id === "undefined" || Number.isNaN(it.id);
        if (idIsMissing) {
            const guess = byName.get(String(it.name || "").toLowerCase());
            if (guess && Number.isFinite(Number(guess.id)) && Number(guess.id) > 0) {
                it.id = Number(guess.id);
            }
        }
        return it;
    });
}


// utils/stripe/buildOrderPayload.mjs

/**
 * Build your internal order payload from a Stripe Checkout Session + normalized items.
 *
 * @param {object} params
 * @param {object} params.session - Stripe Checkout Session object
 * @param {Array<{id:(number|string), name:string, quantity:number, unit_amount:number}>} params.items
 * @returns {{
 *   name:string,
 *   email:string,
 *   amount_total:number,
 *   currency:string,
 *   items:Array,
 *   metadata:{
 *     stripe_session_id:string,
 *     client_reference_id:string,
 *     payment_status:string,
 *     phone:string,
 *     notes:string,
 *     address:{ line1:string, line2:string, city:string, postal_code:string, country:string }
 *   }
 * }}
 */
/**
 * Build your internal order payload from a Stripe Checkout Session + normalized items.
 */
export function buildOrderPayload({ session, items }) {
    const shipping = session?.shipping_details?.address || {};
    const billing = session?.customer_details?.address || {};
    const meta = session?.metadata || {};

    const pick = (a, b, c, fallback = "") => a ?? b ?? c ?? fallback;

    return {
        name: pick(session?.customer_details?.name, meta?.full_name, ""),
        email: pick(session?.customer_details?.email, session?.customer_email, ""),
        amount_total: Number(session?.amount_total) || 0, // cents
        currency: String(session?.currency || "").toLowerCase(),
        items: Array.isArray(items) ? items : [],

        metadata: {
            stripe_session_id: session?.id || "",
            client_reference_id: session?.client_reference_id || "",
            payment_status: session?.payment_status || "",
            phone: pick(session?.customer_details?.phone, meta?.phone, ""),
            notes: meta?.notes || "",
            address: {
                // Prefer shipping, then billing, then your pre-checkout metadata
                line1: pick(shipping.line1, billing.line1, meta?.addr_line1, ""),
                line2: pick(shipping.line2, billing.line2, meta?.addr_line2, ""),
                city: pick(shipping.city, billing.city, meta?.addr_city, ""),
                postal_code: pick(shipping.postal_code, billing.postal_code, meta?.addr_postal, ""),
                country: pick(shipping.country, billing.country, meta?.addr_country, ""),
            },
        },
    };
}
