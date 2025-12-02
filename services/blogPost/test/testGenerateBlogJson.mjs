// test/testGenerateBlogJson.js
import { writeFile } from "fs/promises";
import { buildFullBlogFromDocx } from "../buildFullBlogFromDocx.js";

const docxPath =
  "C:/Projectos/dataBaseUi/dataBaseUi/dataBase/src/components/services/blogPost/input.docx";


(async () => {
  try {
    console.log("⏳ Building full blog JSON from DOCX...");


    const blog = await buildFullBlogFromDocx(docxPath);

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
