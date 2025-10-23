import handlerFactory from "../utils/handleFactory.mjs";

export default function createPageApi(pageServices) {
  if (!pageServices || typeof pageServices.getPageConfig !== "function") {
    throw new Error("Page API requires a pageServices with getPageConfig()");
  }

  return {
    getPageApi: handlerFactory(internalGetPageAPI),
  };

  async function internalGetPageAPI() {
    return pageServices.getPageConfig();
  }
}
