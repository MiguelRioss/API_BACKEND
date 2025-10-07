// utils/handleFactory.mjs
import errosMapping from "../errors/errosMapping.mjs";

/**
 * Wrap an async route handler and normalize success/error responses.
 * Controllers can either:
 *   - send the response themselves (rsp.json/redirect/etc);
 *   - return a plain value (we'll JSON it);
 *   - return an AppError-like object ({ httpStatus, code, message }) to signal failure;
 *   - throw/reject with an AppError or any Error.
 */
export default function handlerFactory(fn) {
  if (typeof fn !== "function") {
    throw new TypeError("handleFactory expects a function");
  }

  return async function handler(req, rsp, next) {
    try {
      const result = await Promise.resolve(fn(req, rsp, next));

      if (rsp.headersSent) {
        return result;
      }

      if (isAppError(result)) {
        return sendError(rsp, result);
      }

      if (result !== undefined) {
        return rsp.json(result);
      }

      return result;
    } catch (error) {
      return sendError(rsp, error);
    }
  };
}

function isAppError(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      "httpStatus" in value &&
      "code" in value &&
      typeof value.message === "string"
  );
}

function sendError(rsp, appError) {
  console.error(appError);
  const httpError = errosMapping(appError);
  rsp.status(httpError.status).json(httpError.body);
}
