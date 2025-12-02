import fs from "node:fs";
import { buildFullBlogFromDocx } from "../buildFullBlogFromDocx.js";

const docxPath =
  "C:/Projectos/dataBaseUi/dataBaseUi/dataBase/src/components/services/blogPost/input.docx";

(async () => {
  try {
    const blog = await buildFullBlogFromDocx(docxPath);

    fs.writeFileSync(
      "./output-full-blog.json",
      JSON.stringify(blog, null, 2),
      "utf-8"
    );

    console.log("✅ Full blog JSON created: output-full-blog.json");
    console.log("Title:", blog.title);
    console.log("Slug:", blog.slug);
    console.log("Sections:", blog.sections.length);
    console.log("CTAs:", blog.ctas.length);
    console.log("Breadcrumbs:", blog.breadcrumbs);
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
