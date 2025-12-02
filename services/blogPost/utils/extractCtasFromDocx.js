import fs from "node:fs/promises";
import mammoth from "mammoth";

/**
 * extractCtasFromDocx()
 * Reads a DOCX file and extracts CTA links written like:
 * CTA: [label](https://url.com)
 */
export async function extractCtasFromDocx(docxPath) {
  const buffer = await fs.readFile(docxPath);
  const { value: raw } = await mammoth.extractRawText({ buffer });

  const text = raw.replace(/\r/g, "");
  const regex = /^CTA\s*:\s*\[(.*?)\]\((.*?)\)/gim;
  const ctas = [];

  let match;
  while ((match = regex.exec(text)) !== null) {
    ctas.push({ label: match[1].trim(), href: match[2].trim() });
  }

  // Fallback defaults
  if (ctas.length === 0) {
    ctas.push(
      {
        href: "https://mesodose.com/shop/products/0",
        label: "Explore Ibotinctures",
      },
      {
        href: "https://www.facebook.com/groups/1297206078804311/",
        label: "Join the Community",
      }
    );
  }

  return ctas;
}
