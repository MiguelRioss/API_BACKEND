/**
 * Turn the raw meta object from buildMetaBlog()
 * into the final blog JSON for the Mesodose site.
 *
 * input:  { seo, sections, keywords, ctas }
 * output: { title, description, slug, ... } ready for BlogArticleTemplate
 */
export function applyMesodoseMeta(metaBlog) {
  const { seo = {}, sections = [], keywords = [], ctas = [] } = metaBlog;

  const {
    seoTitle = "",
    metaDescription = "",
    slug = "",
  } = seo;

  const nowISO = new Date().toISOString();

  // Basic tags – you can tweak this later
  const tags = ["Ibogaine", "Mesodosing", "Personal Journey"];

  // Breadcrumbs for Mesoblog
  const breadcrumbs = [
    { href: "/mesoblog", name: "MesoBlog" },
    slug && seoTitle
      ? { href: `/mesoblog/${slug}`, name: seoTitle }
      : null,
  ].filter(Boolean);

  return {
    // Core SEO / display fields
    title: seoTitle || "Untitled Blog Post",
    description: metaDescription || "",
    slug,

    // keywords array already parsed in buildMetaBlog
    keywords,

    // Brand meta
    author: "Mesodose",
    heroImageId: 0,             // you can change manually per blog if needed
    updatedAtISO: nowISO,

    // Content
    sections,
    ctas,
    tags,
    breadcrumbs,

    // Keep original SEO object too if you want it later
    seo,
  };
}
