import fs from "node:fs/promises";
import mammoth from "mammoth";

/**
 * extractSeoFromDocx() — robust JavaScript version
 * Handles:
 * - smart colons “：”
 * - extra spaces & non-breaking spaces
 * - "Keywords and Keyphrases:"
 * - prevents "Main Photo:" leaking into keywords
 * - newline-separated keywords
 * - slug fallback from SEO title
 */
export async function extractSeoFromDocx(docxPath) {
  const buffer = await fs.readFile(docxPath);
  const { value: raw } = await mammoth.extractRawText({ buffer });

  let text = raw.replace(/\r/g, "").trim();

  // Normalise weird unicode & colons
  text = text
    .replace(/\u00A0/g, " ") // non-breaking spaces → normal spaces
    .replace(/\uFF1A/g, ":"); // fullwidth colon → normal colon

  // 1) Normalise label variants to canonical forms
  text = text
    .replace(/SEO\s*TITLE\s*:/gi, "SEO TITLE: ")
    .replace(/META\s*DESCRIPTION\s*:/gi, "META DESCRIPTION: ")
    .replace(/^Slug\s*:/gim, "SLUG: ")
    .replace(/KEYWORDS\s*(?:AND\s*KEYPHRASES)?\s*:/gi, "KEYWORDS: ")
    .replace(/MAIN\s*PHOTO\s*:/gi, "MAIN PHOTO: ");

  // 2) Ensure each label starts on its own line
  text = text.replace(
    /(SEO TITLE|META DESCRIPTION|SLUG|KEYWORDS|MAIN PHOTO)\s*:\s*/g,
    "\n$1: "
  );

  const LABELS_PATTERN = "SEO TITLE|META DESCRIPTION|SLUG|KEYWORDS|MAIN PHOTO";

  const getField = (label, singleLine = false) => {
    const stopPattern = `\\n(?:${LABELS_PATTERN})\\s*:|\\n\\d+\\.`; // next label or numbered section
    const re = new RegExp(
      `${label}\\s*:\\s*([\\s\\S]*?)(?=${stopPattern}|$)`,
      "i"
    );
    const match = text.match(re);
    if (!match) return "";

    let value = match[1].trim();
    if (singleLine) value = value.replace(/\s+/g, " ");
    return value;
  };

  const seoTitle = getField("SEO TITLE", true);
  const metaDescription = getField("META DESCRIPTION", true);
  let slug = getField("SLUG", true);
  let keywordsRaw = getField("KEYWORDS");

  // Strip any "Main Photo:" that slipped into the KEYWORDS block
  keywordsRaw = keywordsRaw.replace(/MAIN PHOTO\s*:.*$/i, "");

  // Remove anything after a numbered heading if still present
  keywordsRaw = keywordsRaw.replace(/\s*\d+\..*$/s, "");

  // Split on commas, semicolons OR newlines
  const keywords = [...new Set(
    keywordsRaw
      .replace(/\.$/, "")
      .split(/[,;\n]+/)
      .map(k => k.trim())
      .filter(Boolean)
  )];

  // Fallback: auto-generate slug from SEO title if missing
  if (!slug && seoTitle) {
    slug = seoTitle
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  return {
    seoTitle,
    metaDescription,
    slug,
    keywords,
  };
}
