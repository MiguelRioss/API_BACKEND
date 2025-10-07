// controllers/stripeApi.mjs
import handlerFactory from "../utils/handleFactory.mjs";

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
    return {
      handleCheckoutSession: handlerFactory(handleCheckoutSession)
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
        });
    }
}
