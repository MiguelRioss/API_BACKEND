import handlerFactory from "../utils/handleFactory.mjs";
import path from "path";
import os from "os";
import fs from "fs/promises";
import errors from "../errors/errors.mjs";
import { buildFullBlogFromDocx } from "../services/blogPost/buildFullBlogFromDocx.js";

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
    importBlogsFromDocxApi: handlerFactory(internalImportBlogsFromDocxApi),
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
    return pageServices.deleteBlogBySlug(slugBlogPost);
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

 async function internalImportBlogsFromDocxApi(req, res, next) {
  try {
    const files = req.files || [];
    if (!files.length) {
      throw errors.invalidData("No .docx files uploaded");
    }

    const results = [];

    for (const file of files) {
      // 1) write buffer to temp file
      const tmpPath = path.join(
        os.tmpdir(),
        `${Date.now()}_${file.originalname}`
      );
      await fs.writeFile(tmpPath, file.buffer);

      // 2) DOCX → JSON
      const blogJson = await buildFullBlogFromDocx(tmpPath);

      // 3) cleanup temp file
      await fs.unlink(tmpPath).catch(() => {});

      // 4) save to DB (this calls your db.addBlogJsonObject inside the service)
      const saved = await pageServices.addBlogJsonObject(blogJson);
      results.push(saved);
    }

    res.status(201).json({
      imported: results.length,
      blogs: results,
    });
  } catch (err) {
    next(err);
  }
}
}
