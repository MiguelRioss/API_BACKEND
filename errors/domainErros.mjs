// api/errors/domainErrors.mjs
export class DomainError extends Error {
  constructor(message, { code = "DOMAIN_ERROR", details = null } = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  constructor(message = "Validation failed", details = null) {
    super(message, { code: "VALIDATION_ERROR", details });
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Not found") {
    super(message, { code: "NOT_FOUND" });
  }
}

export class ExternalServiceError extends DomainError {
  constructor(message = "External service error", details = null) {
    super(message, { code: "EXTERNAL_SERVICE_ERROR", details });
  }
}
