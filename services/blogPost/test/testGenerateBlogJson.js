// test/testGenerateBlogJson.js
import { writeFile } from "fs/promises";
import { buildFullBlogFromDocx } from "../buildFullBlogFromDocx.js";

const docxPath =
  "C:/Projectos/dataBaseUi/dataBaseUi/dataBase/src/components/services/blogPost/input.docx";

const seoOverride = {
  seoTitle:
    "Ibogaine Mesodosing Week One: From Numbing Habits to Small Acts of Self-Respect",
  metaDescription:
    "A personal ibogaine mesodosing diary: how gentle daily drops, journalling and small rituals began to loosen ten months of numbness and burnout.",
  slug: "ibogaine-mesodosing-week-1",
  keywords: [
    "ibogaine mesodosing",
    "ibogaine microdosing",
    "iboga micro-dosing",
    "ibogaine meso-dosing journal",
    "ibogaine tincture",
    "mesodosing with ibogaine tincture",
    "meso dosing with ibotincture",
    "ibogaine meso dosing for alcohol cravings",
    "ibogaine mesodosing for shame and guilt",
    "ibogaine mesodosing for nervous system regulation",
    "ibogaine mesodosing for burnout and self-worth",
    "ibogaine microdosing experience",
    "plant medicine integration and mesodosing",
  ],
};

(async () => {
  try {
    console.log("⏳ Building full blog JSON from DOCX...");
    const blog = await buildFullBlogFromDocx(docxPath, seoOverride);

    const outPath = "./output-blog-final.json";
    await writeFile(outPath, JSON.stringify(blog, null, 2), "utf8");

    console.log(`✅ Blog JSON saved to: ${outPath}`);
    console.log("──────────────────────────────");
    console.log("TITLE:", blog.title);
    console.log("DESCRIPTION:", blog.description);
    console.log("SLUG:", blog.slug);
    console.log("SECTIONS:", blog.sections.length);
    console.log("CTAs:", blog.ctas.length);
    console.log(
      "KEYWORDS:",
      blog.keywords.slice(0, 5),
      blog.keywords.length > 5 ? "..." : ""
    );
    console.log("──────────────────────────────");
  } catch (err) {
    console.error("❌ Error building blog:", err);
  }
})();
