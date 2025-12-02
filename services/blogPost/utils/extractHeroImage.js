// utils/extractHeroImage.js

import fs from "fs";
import mammoth from "mammoth";

/**
 * Extract the first <img> BEFORE the first numbered section (the true hero).
 * If none is found there, fallback to first image in section[0].
 */
export async function extractHeroImage(docxPath, sections = []) {
  // 1️⃣ Convert whole DOCX to HTML
  const { value: fullHtml } = await mammoth.convertToHtml({ path: docxPath });

  // 2️⃣ Find the first numbered section marker (e.g. "11111.")
  const firstSectionMatch = fullHtml.match(/<p[^>]*?>\s*(?:<strong>|<b>)?\s*1{5}\s*\.[^<]+<\/p>/i);
  const firstSectionStart = firstSectionMatch ? firstSectionMatch.index : fullHtml.length;

  // 3️⃣ Search for the first <img> BEFORE that section
  const imgRegex = /<img[^>]*src="([^"]+)"[^>]*>/i;
  const heroMatch = fullHtml.slice(0, firstSectionStart).match(imgRegex);

  // 4️⃣ Determine hero image src/html
  let heroImageSrc = null;
  let heroImageHtml = null;

  if (heroMatch) {
    heroImageSrc = heroMatch[1];
    heroImageHtml = heroMatch[0];
  } else if (sections[0]?.html) {
    // fallback if no image before first numbered section
    const fallbackMatch = sections[0].html.match(imgRegex);
    if (fallbackMatch) {
      heroImageSrc = fallbackMatch[1];
      heroImageHtml = fallbackMatch[0];
      // remove it from section so it doesn’t duplicate
      sections[0].html = sections[0].html.replace(fallbackMatch[0], "").trim();
    }
  }

  // ✅ Return both hero data + sections untouched or modified
  return { heroImageSrc, heroImageHtml, sections };
}
