// domain/dbErrors.mjs

function DatabaseError(code, message, details = {}) {
  return { code, message, details };
}

export const ERROR_CODES = {
  ExternalService: 100,
  NotFound: 101,
  PermissionDenied: 102,
  WriteFailed: 103,
  InvalidData: 104,
  NotAuthorized: 105,
};

export default {
  EXTERNAL_SERVICE_ERROR: (message, details) =>
    DatabaseError(ERROR_CODES.ExternalService, message, details),
  NOT_FOUND: (message, details) =>
    DatabaseError(ERROR_CODES.NotFound, message, details),
  PERMISSION_DENIED: (message, details) =>
    DatabaseError(ERROR_CODES.PermissionDenied, message, details),
  WRITE_FAILED: (message, details) =>
    DatabaseError(ERROR_CODES.WriteFailed, message, details),
  INVALID_DATA: (message, details) =>
    DatabaseError(ERROR_CODES.InvalidData, message, details),
  NOT_AUTHORIZED: (message, details) =>
    DatabaseError(ERROR_CODES.NotAuthorized, message, details),
};
