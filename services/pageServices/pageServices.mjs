// api/services/pageServicesFactory.mjs

import errors from "../../errors/errors.mjs";

export default function createPageServices(db) {
  if (!db || typeof db.getPageConfig !== "function") {
    return errors.externalService(
      "PageService requires a db with getPageConfig()"
    );
  }

  return {
    getPageConfig,
    getBlogPost,
    getAllBlogs,
    deleteBlogBySlug,
    addBlogJsonObject,
    getAllIndividualBlogsServices,
    getAllBlogSeriesServices,
  };

  /**
   * Fetches the site/page configuration from Firestore or Realtime DB.
   * @returns {Promise<Object>} Page configuration object
   */
  async function getPageConfig() {
    try {
      const config = await db.getPageConfig();
      if (!config) {
        throw errors.notFound("Page configuration not found");
      }
      return config;
    } catch (err) {
      console.error("[pageServices] Failed to fetch page config:", err);
      throw errors.externalService("Failed to retrieve page configuration", {
        original: err,
      });
    }
  }
  /**
   * Get The Blog Post given the slug.
   * @returns {Promise<Object>} BlogOject Promise
   */
  async function getBlogPost(slugBlogPost) {
    const post = await db.getBlogPost(slugBlogPost);
    if (!post) {
      throw errors.notFound(`Post ${slugBlogPost}`);
    }
    return post;
  }
  /**
   * Delete the blug given the slug.
   * @returns {Promise<Object>} BlogOject Promise
   */
  async function deleteBlogBySlug(slugBlogPost) {
    const post = await db.deleteBlogBySlug(slugBlogPost);
    if (!post) {
      throw errors.notFound(`Post ${slugBlogPost}`);
    }
    return post;
  }

  /**
   * Get All blogs Post
   * @return {Promise<Object>} Returns a promise of all the blogs
   */
  async function getAllBlogs() {
    const blogs = await db.getAllBlogs();
    if (!blogs) {
      throw errors.notFound("No blogs were found");
    }
    return blogs;
  }

  /**
   * Get All blogs Post
   * @return {Promise<Object>} Returns a promise of all the blogs
   */
  async function getAllIndividualBlogsServices() {
    const individualBlogs = await db.getAllIndividualBlogs();
    if (!individualBlogs.length) {
      throw errors.notFound("No blogs were found");
    }
    return individualBlogs;
  }

  /**
   * Get All blogs Post
   * @return {Promise<Object>} Returns a promise of all the blogs
   */
  async function getAllBlogSeriesServices() {
    const blogs = await db.getAllBlogSeries();
    if (!blogs) {
      throw errors.notFound("No blogs were found");
    }
    return blogs;
  }

  /**
   * Get All blogs Post
   * @return {Promise<Object>} Returns a promise of all the blogs
   */
  async function addBlogJsonObject(jsonBlogObject) {
    const blog = await db.addBlogJsonObject(jsonBlogObject);
    return blog;
  }
}
