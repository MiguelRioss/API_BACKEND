// domain/dbErrors.mjs

function DatabaseError(code, message, details = {}) {
  this.code = code;
  this.message = message;
  this.details = details;
}

export const DB_ERROR_CODES = {
  ExternalService: 100,
  NotFound: 101,
  PermissionDenied: 102,
  WriteFailed: 103,
};

export default {
  EXTERNAL_SERVICE_ERROR: (message, details) =>
    DatabaseError(DB_ERROR_CODES.ExternalService, message, details),
  NOT_FOUND: (message, details) =>
    DatabaseError(DB_ERROR_CODES.NotFound, message, details),
  PERMISSION_DENIED: (message, details) =>
    DatabaseError(DB_ERROR_CODES.PermissionDenied, message, details),
  WRITE_FAILED: (message, details) =>
    DatabaseError(DB_ERROR_CODES.WriteFailed, message, details),
};
