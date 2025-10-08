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
                Number.isFinite(asNum) && asNum >= 0
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
                if (guess && Number.isFinite(Number(guess.id)) && Number(guess.id) >= 0) {
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
        const meta = session?.metadata || {};

        const shippingDetails = session?.shipping_details || {};
        const billingDetails = session?.customer_details || {};

        const shippingAddress = normalizeAddress([
            pickAddressFields(shippingDetails),
            buildMetaAddress(meta, "ship"),
            buildMetaAddress(meta, "addr"),
        ]);

        const billingAddress = normalizeAddress([
            pickAddressFields(billingDetails),
            buildMetaAddress(meta, "bill"),
            buildMetaAddress(meta, "addr"),
        ]);

        const contactPhone = pickFirst([
            billingDetails?.phone,
            shippingDetails?.phone,
            meta?.phone,
        ]);

        const legacyAddress =
            hasAddress(shippingAddress) ? shippingAddress :
            hasAddress(billingAddress) ? billingAddress :
            buildMetaAddress(meta, "addr");

        return {
            name: pickFirst([
                billingDetails?.name,
                meta?.full_name,
            ]),
            email: pickFirst([
                billingDetails?.email,
                session?.customer_email,
            ]),
            amount_total: Number(session?.amount_total) || 0, // cents
            currency: String(session?.currency || "").toLowerCase(),
            items: Array.isArray(items) ? items : [],

            metadata: {
                stripe_session_id: session?.id || "",
                client_reference_id: session?.client_reference_id || "",
                payment_status: session?.payment_status || "",
                phone: contactPhone,
                notes: meta?.notes || "",
                billing_same_as_shipping: toBoolean(meta?.billing_same_as_shipping),
                shipping_address: shippingAddress,
                billing_address: billingAddress,
            },
        };
    }

function pickAddressFields(details = {}) {
        const addr = details?.address || details;
        return {
            name: details?.name ?? addr?.name ?? "",
            line1: addr?.line1 ?? "",
            line2: addr?.line2 ?? "",
            city: addr?.city ?? "",
            state: addr?.state ?? addr?.province ?? addr?.region ?? "",
            postal_code: addr?.postal_code ?? addr?.postalCode ?? "",
            country: addr?.country ?? "",
            phone: details?.phone ?? addr?.phone ?? "",
        };
    }

function buildMetaAddress(meta = {}, prefix = "") {
        const normalizeKey = (key) => key ? String(key).trim() : "";
        const p = prefix ? `${prefix}_` : "";
        return {
            name: normalizeKey(meta[`${p}name`]),
            line1: normalizeKey(meta[`${p}line1`]),
            line2: normalizeKey(meta[`${p}line2`]),
            city: normalizeKey(meta[`${p}city`]),
            state: normalizeKey(meta[`${p}state`]),
            postal_code: normalizeKey(meta[`${p}postal`]) || normalizeKey(meta[`${p}postal_code`]),
            country: normalizeKey(meta[`${p}country`]),
            phone: normalizeKey(meta[`${p}phone`]),
        };
    }

function emptyAddress() {
        return {
            name: "",
            line1: "",
            line2: "",
            city: "",
            state: "",
            postal_code: "",
            country: "",
            phone: "",
        };
    }

function normalizeAddress(candidates = []) {
        const result = emptyAddress();
        for (const candidate of candidates) {
            if (!candidate) continue;

            const source = candidate.address ? pickAddressFields(candidate) : candidate;

            mergeAddress(result, source);
        }
        return result;
    }

function mergeAddress(target, source = {}) {
        if (!target || !source) return;

        const map = {
            name: ["name"],
            line1: ["line1"],
            line2: ["line2"],
            city: ["city"],
            state: ["state", "province", "region"],
            postal_code: ["postal_code", "postalCode", "zip"],
            country: ["country"],
            phone: ["phone"],
        };

        for (const [key, aliases] of Object.entries(map)) {
            if (target[key]) continue;

            for (const alias of aliases) {
                const value = source?.[alias];
                if (value != null && String(value).trim() !== "") {
                    target[key] = String(value).trim();
                    break;
                }
            }
        }
    }

function hasAddress(address) {
        if (!address) return false;
        return ["line1", "line2", "city", "state", "postal_code", "country"].some((key) => {
            const value = address[key];
            return value != null && String(value).trim() !== "";
        });
    }

function pickFirst(values = [], fallback = "") {
        for (const value of values) {
            if (value != null && String(value).trim() !== "") {
                return String(value).trim();
            }
        }
        return fallback;
    }

function toBoolean(value) {
        if (typeof value === "boolean") return value;
        if (typeof value === "string") {
            return value.toLowerCase() === "true" || value === "1";
        }
        return false;
    }
