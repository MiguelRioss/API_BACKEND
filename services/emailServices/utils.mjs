// utils/buildLogoSrc.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Converts a local or remote logo path into a usable src string.
 * - If it's an HTTP(S) URL → returns unchanged
 * - If it's a local file → returns base64 data URI
 * - If not found → returns ""
 */
export async function buildLogoSrc(logoPath) {
  if (!logoPath) return "";
  if (/^https?:\/\//i.test(logoPath)) return logoPath;

  const asset = await resolveLogoFile(logoPath);
  if (!asset) {
    warnMissingLogo(logoPath);
    return "";
  }

  return `data:${asset.mimeType};base64,${asset.buffer.toString("base64")}`;
}



function getMimeType(file) {
  const ext = path.extname(file).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

async function resolveLogoFile(logoPath) {
  const candidatePaths = [];
  if (path.isAbsolute(logoPath)) {
    candidatePaths.push(logoPath);
  } else {
    candidatePaths.push(path.resolve(process.cwd(), logoPath));
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    candidatePaths.push(path.resolve(moduleDir, logoPath));
  }

  for (const candidate of candidatePaths) {
    try {
      const buffer = await fs.readFile(candidate);
      return {
        buffer,
        mimeType: getMimeType(candidate),
        filePath: candidate,
      };
    } catch {
      // try next
    }
  }

  return null;
}

function warnMissingLogo(logoPath) {
  console.warn(`[logoUtils] Logo not found at path: ${logoPath}`);
}




/**
 * Builds a Brevo-compatible inline image attachment.
 * @param {string} filePath - absolute or relative path to the image
 * @param {string} cid - content ID for <img src="cid:...">
 * @returns {{ cid: string, attachment: object }}
 */
export async function buildInlineImage(filePath, cid = "inline-logo") {
  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    const contentType =
      ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".gif"
        ? "image/gif"
        : "image/png";

    // ✅ Brevo expects this format:
    return {
      cid,
      attachment: {
        name: path.basename(filePath),
        content: file.toString("base64"),
        contentType, // ✅ not "type"
        contentId: cid, // ✅ required for inline
      },
    };
  } catch (err) {
    console.warn("⚠️ Inline image not found or unreadable:", filePath, err.message);
    return null;
  }
}