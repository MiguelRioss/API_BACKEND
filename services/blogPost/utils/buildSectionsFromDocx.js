// utils/buildSectionsFromDocx.js
import mammoth from "mammoth";
import { slugify } from "./slugify.js";

export async function buildSectionsFromDocx(docxPath) {
  const { value: fullHtml } = await mammoth.convertToHtml({ path: docxPath });

  // Split into paragraphs
  const paragraphRegex = /<p[^>]*>[\s\S]*?<\/p>/gi;
  const paragraphs = [];
  let match;
  while ((match = paragraphRegex.exec(fullHtml)) !== null) {
    const html = match[0];
    const text = html
      .replace(/^<p[^>]*>/i, "")
      .replace(/<\/p>$/i, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
    paragraphs.push({
      html,
      text,
      start: match.index,
      end: paragraphRegex.lastIndex,
    });
  }

  // Detect section headers = paragraphs that start with 5 digits followed by a dot
  // e.g. "11111.", "22222.", etc.
  const headingParas = paragraphs.filter((p) => /^\d{5}\./.test(p.text));

  if (!headingParas.length) {
    console.warn("⚠️ No 5-digit section markers (e.g. 11111.) found!");
    return [];
  }

  const sections = [];

  for (let i = 0; i < headingParas.length; i++) {
    const heading = headingParas[i];
    const nextHeading = headingParas[i + 1];

    // Title = the text of that heading line
    const titleText = heading.text;
    const cleanTitle = titleText.replace(/^\d{5}\./, "").trim();
    const id = slugify(cleanTitle);

    const contentStart = heading.end;
    const contentEnd = nextHeading ? nextHeading.start : fullHtml.length;
    const htmlContent = fullHtml.slice(contentStart, contentEnd).trim();

    sections.push({
      title: cleanTitle,
      id,
      imageId: i + 1,
      html: htmlContent,
    });
  }

  return sections;
}
