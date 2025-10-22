// api/stripeAPI.mjs

//later Have auth and validation middleware
import handlerFactory from "../utils/handleFactory.mjs";
import prepareCheckOut from "./prepareCheckOut.mjs";

export default function createPromotionCodeAPI(promotionCodeServices) {
  return {
    createPromoCode: handlerFactory(internalCreatePromoCode),
    getPromoCodes: handlerFactory(internalGetPromoCodes),
    updatePromoCode: handlerFactory(internalUpdatePromoCode),
  };

  async function internalCreatePromoCode(req, rsp) {
    const body = req.body ?? {};
    const promoCode = body.promocode;
    return promotionCodeServices.createPromoCode(promoCode);
  }

  async function internalGetPromoCodes(req, rsp) {
    return promotionCodeServices.getPromoCodes();
  }
  async function internalUpdatePromoCode(req, rsp) {
    const body = req.body ;
    const id = req.params.id;
    const changes = body.changes ;
    return promotionCodeServices.updatePromoCode(id,changes);
  }
}
