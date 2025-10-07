// domain/httpErrors.mjs

function AppError(httpStatus, code, message, details = {}) {
  return { httpStatus, code, message, details };
}

// Canonical HTTP status codes you'll actually use
export const HTTP = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,            // auth needed / bad or missing API key
  PAYMENT_REQUIRED: 402,         // card/payment errors (Stripe card declines)
  FORBIDDEN: 403,                // authenticated but not allowed
  NOT_FOUND: 404,
  CONFLICT: 409,                 // state conflict (e.g., duplicate, version)
  UNPROCESSABLE_ENTITY: 422,     // validation passed format, failed semantics
  TOO_MANY_REQUESTS: 429,        // rate limit
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,              // upstream service failed
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
};

// App-level string codes for easier programmatic handling/logging
export const CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  PAYMENT_REQUIRED: "PAYMENT_REQUIRED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INVALID_DATA: "INVALID_DATA",                  // maps to 422
  RATE_LIMITED: "RATE_LIMITED",                  // maps to 429
  EXTERNAL_SERVICE: "EXTERNAL_SERVICE",          // maps to 502
  INTERNAL_ERROR: "INTERNAL_ERROR",              // maps to 500

  // Stripe-specific convenience codes
  STRIPE_AUTH_FAILED: "STRIPE_AUTH_FAILED",      // 401 (bad API key / restricted key)
  STRIPE_CARD_ERROR: "STRIPE_CARD_ERROR",        // 402 (card declined, insufficient funds, etc.)
  STRIPE_RATE_LIMITED: "STRIPE_RATE_LIMITED",    // 429
};

export default {
  badRequest: (message = "Bad request", details) =>
    AppError(HTTP.BAD_REQUEST, CODES.BAD_REQUEST, message, details),

  unauthorized: (message = "Unauthorized", details) =>
    AppError(HTTP.UNAUTHORIZED, CODES.UNAUTHORIZED, message, details),

  forbidden: (message = "Forbidden", details) =>
    AppError(HTTP.FORBIDDEN, CODES.FORBIDDEN, message, details),

  notFound: (message = "Not found", details) =>
    AppError(HTTP.NOT_FOUND, CODES.NOT_FOUND, message, details),

  conflict: (message = "Conflict", details) =>
    AppError(HTTP.CONFLICT, CODES.CONFLICT, message, details),

  invalidData: (message = "Unprocessable entity", details) =>
    AppError(HTTP.UNPROCESSABLE_ENTITY, CODES.INVALID_DATA, message, details),

  rateLimited: (message = "Too many requests", details) =>
    AppError(HTTP.TOO_MANY_REQUESTS, CODES.RATE_LIMITED, message, details),

  externalService: (message = "Bad gateway", details) =>
    AppError(HTTP.BAD_GATEWAY, CODES.EXTERNAL_SERVICE, message, details),

  internalError: (message = "Internal server error", details) =>
    AppError(HTTP.INTERNAL_SERVER_ERROR, CODES.INTERNAL_ERROR, message, details),

  // Stripe helpers
  stripeAuthFailed: (message = "Stripe authentication failed", details) =>
    AppError(HTTP.UNAUTHORIZED, CODES.STRIPE_AUTH_FAILED, message, details),

  stripeCardError: (message = "Payment required", details) =>
    AppError(HTTP.PAYMENT_REQUIRED, CODES.STRIPE_CARD_ERROR, message, details),

  stripeRateLimited: (message = "Stripe rate limit exceeded", details) =>
    AppError(HTTP.TOO_MANY_REQUESTS, CODES.STRIPE_RATE_LIMITED, message, details),
};
