import { buildSectionsFromDocx } from "./utils/buildSectionsFromDocx.js";
import { extractCtasFromDocx } from "./utils/extractCtasFromDocx.js";
import { buildMetaBlog } from "./utils/buildMetaBlog.js";
import { extractHeroImage } from "./utils/extractHeroImage.js";

export async function buildFullBlogFromDocx(docxPath, seoOverride = {}) {
  console.log("⏳ Building full blog JSON from DOCX...");

  const sections = await buildSectionsFromDocx(docxPath);
  console.log(`✅ Sections extracted: ${sections.length}`);

  const ctas = await extractCtasFromDocx(docxPath);
  console.log(`✅ CTAs extracted: ${ctas.length}`);

  // 🟢 Extract hero *before* meta
  const { heroImageSrc, heroImageHtml, sections: cleanSections } =
    await extractHeroImage(docxPath, sections);

  const blog = buildMetaBlog(cleanSections, seoOverride, ctas);

  return {
    ...blog,
    heroImageSrc,
    heroImageHtml,
  };
}
