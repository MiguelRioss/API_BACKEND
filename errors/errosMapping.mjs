import { CODES, HTTP } from "./errors.mjs";

class HttpError {
  constructor(status, body) {
    this.status = status;
    this.body = body;
  }
}

const ERROR_MAPPING = {
  [CODES.BAD_REQUEST]: HTTP.BAD_REQUEST,
  [CODES.UNAUTHORIZED]: HTTP.UNAUTHORIZED,
  [CODES.PAYMENT_REQUIRED]: HTTP.PAYMENT_REQUIRED,
  [CODES.FORBIDDEN]: HTTP.FORBIDDEN,
  [CODES.NOT_FOUND]: HTTP.NOT_FOUND,
  [CODES.CONFLICT]: HTTP.CONFLICT,
  [CODES.INVALID_DATA]: HTTP.UNPROCESSABLE_ENTITY,
  [CODES.RATE_LIMITED]: HTTP.TOO_MANY_REQUESTS,
  [CODES.EXTERNAL_SERVICE]: HTTP.BAD_GATEWAY,
  [CODES.INTERNAL_ERROR]: HTTP.INTERNAL_SERVER_ERROR,
  [CODES.STRIPE_AUTH_FAILED]: HTTP.UNAUTHORIZED,
  [CODES.STRIPE_CARD_ERROR]: HTTP.PAYMENT_REQUIRED,
  [CODES.STRIPE_RATE_LIMITED]: HTTP.TOO_MANY_REQUESTS,
};

const FALLBACK_ERROR = new HttpError(HTTP.INTERNAL_SERVER_ERROR, {
  code: CODES.INTERNAL_ERROR,
  message: "Unexpected error. Contact your administrator.",
});

export default function mapApplicationError(applicationError) {
  if (!applicationError || typeof applicationError !== "object") {
    return FALLBACK_ERROR;
  }

  const status =
    applicationError.httpStatus ??
    ERROR_MAPPING[applicationError.code] ??
    HTTP.INTERNAL_SERVER_ERROR;

  const code = applicationError.code ?? CODES.INTERNAL_ERROR;
  const message =
    applicationError.message ??
    "Unexpected error. Contact your administrator.";

  const body = { code, message };
  if (applicationError.details !== undefined) {
    body.details = applicationError.details;
  }

  return new HttpError(status, body);
}
