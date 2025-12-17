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
    unsubscribeFromBrevo,
    updateBlogPropertiesBySlug,
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
      (b) =>
        typeof b.id === "string" && !["individual", "blogSeries"].includes(b.id)
    );

    return orderByUpdatedAtISO(topLevelBlogs);
  }

  async function unsubscribeFromBrevo(email) {
    const res = await fetch(
      `https://api.brevo.com/v3/contacts/${encodeURIComponent(
        email
      )}?identifierType=email_id`,
      {
        method: "DELETE",
        headers: {
          "api-key": process.env.BREVO_API_KEY,
        },
      }
    );

    const body = await res.text().catch(() => null);

    return {
      status: res.status,
      ok: res.ok,
      message: body || null,
    };
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

  async function updateBlogPropertiesBySlug(slug, changes = {}) {
    if (!slug) {
      throw errors.invalidData("Slug is required");
    }

    if (!changes || typeof changes !== "object") {
      throw errors.invalidData("Changes must be an object");
    }

    // 1️⃣ Fetch existing blog
    const blog = await db.getBlogPost(slug);
    if (!blog) {
      throw errors.notFound(`Post ${slug}`);
    }

    // 2️⃣ Allowed fields (include updatedAtISO)
    const ALLOWED_FIELDS = [
      "updatedAtISO", // 👈 ADD THIS
    ];

    // 3️⃣ Filter allowed changes
    const sanitizedChanges = Object.fromEntries(
      Object.entries(changes).filter(([key]) => ALLOWED_FIELDS.includes(key))
    );

    // 🔑 Special case: only updatedAtISO requested
    const onlyUpdatingTimestamp =
      Object.keys(sanitizedChanges).length === 1 &&
      "updatedAtISO" in sanitizedChanges;

    if (!Object.keys(sanitizedChanges).length) {
      throw errors.invalidData("No valid fields to update");
    }

    // 4️⃣ Build update
    const updatedBlog = {
      ...blog,
      ...(onlyUpdatingTimestamp ? {} : sanitizedChanges),
      updatedAtISO: new Date().toISOString(), // always server time
    };

    // 5️⃣ Persist
    await db.updateBlogBySlug(slug, updatedBlog);

    return updatedBlog;
  }
}
