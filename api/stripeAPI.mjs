// controllers/stripeApi.mjs
import Stripe from "stripe";
import fetch from "node-fetch"; // If you're on Node 18+, you can remove this and use global fetch

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * POST /checkout-sessions
 * Body:
 * {
 *   items: [{ id: string|number, qty?: number }],
 *   clientReferenceId?: string,
 *   customer?: { name?: string, email?: string, phone?: string, notes?: string },
 *   address?: { line1?: string, line2?: string, city?: string, postal_code?: string, country?: string }
 * }
 */
export default function createStripeAPI(stripeServices) {
    const startedAt = Date.now();
    return {
        handleCheckoutSession
    }


    async function handleCheckoutSession(req, rsp) {
        const {
            items = [],
            clientReferenceId,
            customer = {},
            address = {},
        } = req.body || {};

        return stripeServices.createCheckoutSession({
            items, clientReferenceId, customer, address
        }).then(
            session => rsp.json({ url: session.url })
        )
    }
}
