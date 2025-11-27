import { getAllBlogs } from "../database/realDB/firebaseDB.mjs";
import handlerFactory from "../utils/handleFactory.mjs";

export default function createPageApi(pageServices) {
  if (!pageServices || typeof pageServices.getPageConfig !== "function") {
    throw new Error("Page API requires a pageServices with getPageConfig()");
  }

  return {
    getPageApi: handlerFactory(internalGetPageAPI),
    getBlogPostApi: handlerFactory(internalGetBlogPostApi),
    getAllBlogs: handlerFactory(internalGetAllBLogPosts),
    deleteBlogBySlug: handlerFactory(internalDeleteBlogBySlugApi),
    addBlogJsonObject: handlerFactory(internalAddBlogJsonObjectApi),
  };

  async function internalGetPageAPI(req, rsp) {
    return pageServices.getPageConfig();
  }
  async function internalGetBlogPostApi(req, rsp) {
    const slugBlogPost = req.params.slug;
    return pageServices.getBlogPost(slugBlogPost);
  }
  async function internalDeleteBlogBySlugApi(req, rsp) {
    const slugBlogPost = req.params.slug;
    return pageServices.deleteBlogPostApi(slugBlogPost);
  }

  // POST /api/blogs
   async function internalAddBlogJsonObjectApi(req, rsp, next) {
    try {
      const blog = await pageServices.addBlogJsonObject(req.body);
      rsp.status(201).json(blog);
    } catch (err) {
      next(err);
    }
  }
  async function internalGetAllBLogPosts(req, rsp) {
    return pageServices.getAllBlogs();
  }
}
