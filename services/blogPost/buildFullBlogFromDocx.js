import { buildSectionsFromDocx } from "./utils/buildSectionsFromDocx.js";
import { extractCtasFromDocx } from "./utils/extractCtasFromDocx.js";
import { extractSeoFromDocx } from "./utils/extractSeoFromDocx.js";
import { buildMetaBlog } from "./utils/buildMetaBlog.js";
import { extractHeroImage } from "./utils/extractHeroImage.js";

export async function buildFullBlogFromDocx(docxPath, seoOverride = {}) {
  console.log("⏳ Building full blog JSON from DOCX...");

  // 1️⃣ Extract SEO block
  const seo = await extractSeoFromDocx(docxPath);
  console.log("🔎 SEO extracted:", seo);

  // Apply optional override (from UI)
  const finalSeo = { ...seo, ...seoOverride };

  // 2️⃣ Extract Sections
  const sections = await buildSectionsFromDocx(docxPath);
  console.log(`✅ Sections extracted: ${sections.length}`);

  // 3️⃣ Extract CTAs
  const ctas = await extractCtasFromDocx(docxPath);
  console.log(`✅ CTAs extracted: ${ctas.length}`);

  // 4️⃣ Extract Hero Image
  const { heroImageSrc, heroImageHtml, sections: cleanSections } =
    await extractHeroImage(docxPath, sections);

  // 5️⃣ Build blog meta USING THE SEO
  const meta = buildMetaBlog(cleanSections, finalSeo, ctas);

  return {
    ...meta,
    heroImageSrc,
    heroImageHtml,
  };
}
