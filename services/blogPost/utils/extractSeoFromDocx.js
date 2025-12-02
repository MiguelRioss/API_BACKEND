import fs from "node:fs/promises";
import mammoth from "mammoth";

/**
 * extractSeoFromDocx() — tolerant version
 * Handles:
 * - smart colons “：”
 * - extra spaces
 * - non-breaking spaces
 * - mixed capitalization
 */
export async function extractSeoFromDocx(docxPath) {
  const buffer = await fs.readFile(docxPath);
  const { value: raw } = await mammoth.extractRawText({ buffer });

  let text = raw.replace(/\r/g, "").trim();

  // Normalize strange unicode characters
  text = text
    .replace(/\u00A0/g, " ")     // non-breaking spaces
    .replace(/\uFF1A/g, ":");    // fullwidth colon “：” → normal colon “:”

  // Ensure line breaks before each field label
  text = text.replace(
    /(SEO TITLE|META DESCRIPTION|SLUG|KEYWORDS)\s*:\s*/gi,
    "\n$1: "
  );

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

  // Prevent KEYWORDS bleeding into section 1
  const keywordsClean = keywordsRaw.replace(/\s*\d+\..*$/s, "").trim();

  const keywords = keywordsClean
    .replace(/\.$/, "")
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
