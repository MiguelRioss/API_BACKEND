import { getCttStatus } from "../ctt/services/status.js";

export default function createCttAPI({ statusService = getCttStatus } = {}) {
  if (typeof statusService !== "function") {
    throw new TypeError("createCttAPI expects a statusService function");
  }

  return { getStatusAPI };

  async function getStatusAPI(req) {
    const rawInput =
      (req.query && req.query.id) ??
      (req.query && req.query.code) ??
      (req.query && req.query.tracking) ??
      (req.query && req.query.url) ??
      null;

    const idOrUrl = typeof rawInput === "string" ? rawInput.trim() : null;

    if (!idOrUrl) {
      return {
        status: 400,
        body: {
          ok: false,
          error: {
            code: "MISSING_ID",
            message: "Query parameter `id` is required",
          },
        },
      };
    }

    const payload = await statusService(idOrUrl);
    return payload;
  }
}
