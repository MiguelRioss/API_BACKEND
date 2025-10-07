// services/stripeServices.mjs
import Stripe from "stripe";
import errors from "../errors/errors.mjs";
import { createUrlCheckoutSession, buildStripeLineItems } from "./stripeUtils.mjs";


export default function createStripeServices(stockServices) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    return { createCheckoutSession };

    /**
     * Creates a Stripe Checkout Session and returns the session object
     */
    async function createCheckoutSession({
        items = [],
        clientReferenceId,
        customer = {},
        address = {},
    }) {
        // Validate items
        if (!Array.isArray(items) || items.length === 0) {
            throw errors.invalidData("No items in payload");
        }

        // 1) Load catalog via stockServices
        const catalog = await stockServices.getAllProducts(); // returns an array
        if (!Array.isArray(catalog)) {
            throw errors.badRequest("Catalog fetch failed (not an array)");
        }

        if (!process.env.STRIPE_SECRET_KEY) {
            throw new errors.forbidden("STRIPE_SECRET_KEY missing");
        }

        //Map BY ID to O(1) search
        const byId = new Map(catalog.map(p => [String(p.id), p]));

        const line_items = buildStripeLineItems({
            items,         // [{ id, qty }, ...]
            byId,          // Map<string, product>
            currency: "eur",
            errorFactory: (msg) => errors.bad(msg), // optional
        });
        const url = await createUrlCheckoutSession({
            stripe,
            line_items,
            customer,
            address,
            clientReferenceId,
            // successUrl: "optional override",
            // cancelUrl:  "optional override",
            // allowedCountries: ["PT","DE", ...] // optional override
        });

        // Return just the URL (controller will res.json({ url }))
        return { url }
    }
}
