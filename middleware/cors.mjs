// api/middleware/cors.mjs
import cors from "cors";

/**
 * createCorsMiddleware()
 * env vars:
 *  - CORS_ORIGINS: comma separated origins, or "*" for any
 *  - CORS_ALLOW_CREDENTIALS: "true" / "false"
 */
export default function createCorsMiddleware() {
  const rawOrigins = process.env.CORS_ORIGINS ?? "*";
  const allowAll = rawOrigins.trim() === "*";
  const origins = allowAll ? [] : rawOrigins.split(",").map(s => s.trim()).filter(Boolean);

  const methods = (process.env.CORS_METHODS || "GET,POST,PUT,PATCH,DELETE,OPTIONS")
    .split(",").map(s => s.trim());

  const allowHeaders = (process.env.CORS_ALLOW_HEADERS || "Content-Type,Authorization")
    .split(",").map(s => s.trim());

  const exposeHeaders = (process.env.CORS_EXPOSE_HEADERS || "")
    .split(",").map(s => s.trim()).filter(Boolean);

  const credentials = String(process.env.CORS_ALLOW_CREDENTIALS ?? "true").toLowerCase() === "true";

  const options = {
    origin: (origin, callback) => {
      // allow non-browser clients (no origin)
      if (!origin) return callback(null, true);
      if (allowAll) return callback(null, true);
      if (origins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS not allowed for this origin"), false);
    },
    methods,
    allowedHeaders: allowHeaders,
    exposedHeaders: exposeHeaders.length ? exposeHeaders : undefined,
    credentials,
    optionsSuccessStatus: 204
  };

  return cors(options);
}
