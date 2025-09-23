// Convert a domain error into an HTTP response
import { DomainError, ValidationError, NotFoundError, ExternalServiceError } from "../errors/domainErrors.mjs";
import { resError } from "./httpResponses.mjs";


export function resFromError(res, err) {
  if (!(err instanceof DomainError)) {
    // Unexpected error: internal server error
    console.error("[UNHANDLED ERROR]", err);
    return resError(res, { code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 });
  }

  // Map domain errors to HTTP statuses
  if (err instanceof ValidationError) {
    return resError(res, { code: err.code, message: err.message, details: err.details }, { status: 400 });
  }
  if (err instanceof NotFoundError) {
    return resError(res, { code: err.code, message: err.message }, { status: 404 });
  }
  if (err instanceof ExternalServiceError) {
    // 502 Bad Gateway for external dependencies
    return resError(res, { code: err.code, message: err.message }, { status: 502 });
  }

  // Generic domain error
  return resError(res, { code: err.code, message: err.message }, { status: 400 });
}
