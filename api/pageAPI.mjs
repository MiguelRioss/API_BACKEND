import handlerFactory from "../utils/handleFactory.mjs";

export default function createPageApi(pageServices) {
  if (!pageServices || typeof pageServices.getPageConfig !== "function") {
    throw new Error("Page API requires a pageServices with getPageConfig()");
  }

  return {
    getPageApi: handlerFactory(internalGetPageAPI),
    getBlogPostApi: handlerFactory(internalGetBlogPostApi)
  };

  async function internalGetPageAPI(req,rsp) {
    return pageServices.getPageConfig();
  }
  async function internalGetBlogPostApi(req ,rsp) {
    const slugBlogPost = req.params.slug
    return pageServices.getBlogPost(slugBlogPost)
  }
}
