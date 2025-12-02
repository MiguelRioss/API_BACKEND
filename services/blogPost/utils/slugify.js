// utils/slugify.js
export function slugify(text = "") {
  return String(text)
    .toLowerCase()
    .trim()
    // Replace accented characters (é → e, ç → c, etc.)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Replace spaces and punctuation with hyphens
    .replace(/[^a-z0-9]+/g, "-")
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, "");
}
