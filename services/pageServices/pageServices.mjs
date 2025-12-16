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

  // ✅ middle function: sort by updatedAtISO (newest first)
  function orderByUpdatedAtISO(list = []) {
    const arr = Array.isArray(list) ? [...list] : [];
    return arr.sort((a, b) => {
      const da = new Date(a?.updatedAtISO || a?.createdAtISO || 0).getTime();
      const db = new Date(b?.updatedAtISO || b?.createdAtISO || 0).getTime();
      return db - da; // newest first
    });
  }

  async function getPageConfig() {
    try {
      const config = await db.getPageConfig();
      if (!config) throw errors.notFound("Page configuration not found");
      return config;
    } catch (err) {
      console.error("[pageServices] Failed to fetch page config:", err);
      throw errors.externalService("Failed to retrieve page configuration", {
        original: err,
      });
    }
  }

  async function getBlogPost(slugBlogPost) {
    const post = await db.getBlogPost(slugBlogPost);
    if (!post) throw errors.notFound(`Post ${slugBlogPost}`);
    return post;
  }

  async function deleteBlogBySlug(slugBlogPost) {
    const post = await db.deleteBlogBySlug(slugBlogPost);
    if (!post) throw errors.notFound(`Post ${slugBlogPost}`);
    return post;
  }
async function getAllBlogs() {
  const blogs = await db.getAllBlogs();
  if (!blogs) throw errors.notFound("No blogs were found");

  // ✅ Keep only first-level blogs (ignore nested groups)
  const topLevelBlogs = blogs.filter(
    (b) => typeof b.id === "string" && !["individual", "blogSeries"].includes(b.id)
  );

  return orderByUpdatedAtISO(topLevelBlogs);
}


  async function getAllIndividualBlogsServices() {
    const individualBlogs = await db.getAllIndividualBlogs();
    if (!individualBlogs?.length) throw errors.notFound("No blogs were found");
    return orderByUpdatedAtISO(individualBlogs);
  }

  async function getAllBlogSeriesServices() {
    const series = await db.getAllBlogSeries();
    if (!series) throw errors.notFound("No blogs were found");

    // series list sorted by series.updatedAtISO,
    // and also sort posts inside each series if present
    const sortedSeries = orderByUpdatedAtISO(series).map((s) => ({
      ...s,
      blogs: orderByUpdatedAtISO(s?.blogs || []),
    }));

    return sortedSeries;
  }

  async function addBlogJsonObject(jsonBlogObject) {
    return db.addBlogJsonObject(jsonBlogObject);
  }
}
