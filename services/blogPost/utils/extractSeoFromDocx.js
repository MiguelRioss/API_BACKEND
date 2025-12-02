import fs from "node:fs/promises";
import mammoth from "mammoth";

/**
 * extractSeoFromDocx()
 * Handles edge cases where KEYWORDS merges with next section text.
 */
export async function extractSeoFromDocx(docxPath) {
  const buffer = await fs.readFile(docxPath);
  const { value: raw } = await mammoth.extractRawText({ buffer });

  let text = raw.replace(/\r/g, "").trim();

  // Guarantee line breaks before each field
  text = text.replace(/(SEO TITLE|META DESCRIPTION|SLUG|KEYWORDS)\s*:/gi, "\n$1:");

  // Helper to isolate fields safely
  const getField = (label) => {
    const re = new RegExp(
      `${label}\\s*:\\s*([\\s\\S]*?)(?=\\n(?:SEO TITLE|META DESCRIPTION|SLUG|KEYWORDS)\\s*:|\\n\\d+\\.|$)`,
      "i"
    );
    const match = text.match(re);
    return match ? match[1].trim().replace(/\s+/g, " ") : "";
  };

  const seoTitle = getField("SEO TITLE");
  const metaDescription = getField("META DESCRIPTION");
  const slug = getField("SLUG");
  const keywordsRaw = getField("KEYWORDS");

  // Cut off if the keyword text somehow runs into section 1.
  const keywordsClean = keywordsRaw.replace(/\s*\d+\..*$/s, "").trim();

  const keywords = keywordsClean
    .replace(/\.$/, "") // remove trailing period
    .split(/[,;]/)
    .map((k) => k.trim())
    .filter(Boolean);

  return {
    seoTitle,
    metaDescription,
    slug,
    keywords,
  };
}
