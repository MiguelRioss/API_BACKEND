// api/middleware/errorHandler.mjs
import { resError } from "../utils/httpResponses.mjs";
import {
  ValidationError,
  NotFoundError,
  ExternalServiceError,
  DomainError
} from "../errors/domainErros.mjs"; // implement these domain error classes

export default function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Unexpected non-domain error
  if (!(err instanceof DomainError)) {
    console.error("[UNEXPECTED ERROR]", err);
    return resError(res, {
      code: "INTERNAL_ERROR",
      message: "Internal server error"
    }, { status: 500 });
  }

  // Map domain errors to HTTP status codes and messages
  if (err instanceof ValidationError) {
    return resError(res, { code: err.code || "VALIDATION_ERROR", message: err.message, details: err.details }, { status: 400 });
  }
  if (err instanceof NotFoundError) {
    return resError(res, { code: err.code || "NOT_FOUND", message: err.message }, { status: 404 });
  }
  if (err instanceof ExternalServiceError) {
    // External dependency failed (Stripe, Firebase etc.)
    return resError(res, { code: err.code || "EXTERNAL_SERVICE_ERROR", message: err.message }, { status: 502 });
  }

  // Generic domain error fallback
  return resError(res, { code: err.code || "DOMAIN_ERROR", message: err.message }, { status: 400 });
}
