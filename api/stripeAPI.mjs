// api/stripeAPI.mjs
import handlerFactory from "../utils/handleFactory.mjs";
import prepareStripeCheckoutOrder from "../utils/prepareStripeCheckoutOrder.mjs";

export default function createStripeAPI(stripeServices) {
  return {
    handleCheckoutSession: handlerFactory(handleCheckoutSession),
  };

  async function handleCheckoutSession(req, rsp) {
    const body = req.body ?? {};
    const orderData = prepareStripeCheckoutOrder(body);
    return stripeServices.createCheckoutSession(orderData);
  }
}
