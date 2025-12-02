import fs from "node:fs";
import { buildMetaBlog } from "../utils/buildMetaBlog.js";

const docxPath =
  "C:/Projectos/dataBaseUi/dataBaseUi/dataBase/src/components/services/blogPost/input.docx";

(async () => {
  try {
    const blog = await buildMetaBlog(docxPath);

    fs.writeFileSync(
      "./output-blog-meta.json",
      JSON.stringify(blog, null, 2),
      "utf-8"
    );

    console.log("✅ Blog meta JSON created: output-blog-meta.json");
    console.log("SEO title:", blog.seo.seoTitle);
    console.log("Sections:", blog.sections.length);
    console.log("CTAs:", blog.ctas);
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
