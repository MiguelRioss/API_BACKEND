// utils/buildMetaBlog.js
import { slugify } from "./slugify.js"; // or your existing helper

export function buildMetaBlog(sections = [], seoOverride = {}, ctas = []) {
  const firstSection = sections[0] || {};
  const rawTitle = firstSection.title || "Untitled Blog Post";

  const title =
    (seoOverride.seoTitle && seoOverride.seoTitle.trim()) || rawTitle;

  const description =
    (seoOverride.metaDescription && seoOverride.metaDescription.trim()) ||
    "No meta description provided. Update this in the DOCX SEO block.";

  const slug =
    (seoOverride.slug && seoOverride.slug.trim()) || slugify(title || "blog");

  let keywords = [];
  if (Array.isArray(seoOverride.keywords)) {
    keywords = seoOverride.keywords;
  } else if (typeof seoOverride.keywords === "string") {
    keywords = seoOverride.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  }

  return {
    title,
    description,
    slug,
    keywords,
    author: "Mesodose",
    heroImageId: 0,
    updatedAtISO: new Date().toISOString(),
    sections,
    ctas,
    tags: ["Ibogaine", "Mesodosing", "Personal Journey"],
    breadcrumbs: [
      { href: "/mesoblog", name: "MesoBlog" },
      { href: `/mesoblog/${slug}`, name: title },
    ],
  };
}
