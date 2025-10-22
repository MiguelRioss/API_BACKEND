// api/stripeAPI.mjs

//later Have auth and validation middleware
import handlerFactory from "../utils/handleFactory.mjs";
import prepareCheckOut from "./prepareCheckOut.mjs";

export default function createPromotionCodeAPI(promotionCodeServices) {
  return {
    createPromoCode: handlerFactory(internalCreatePromoCode),
    getPromoCodes: handlerFactory(internalGetPromoCodes),
  };

  async function internalCreatePromoCode(req, rsp) {
    const body = req.body ?? {};
    const promoCode = body.promoCode;
    console.log(promoCode)
    return promotionCodeServices.createPromoCode(discount);
  }

  async function internalGetPromoCodes(req, rsp) {
    return promotionCodeServices.getPromoCodes();
  }
}
