// api/test/testErrors.mjs
import { ValidationError, NotFoundError, ExternalServiceError } from "../../errors/domainErros.mjs";

/**
 * Test handler that throws different domain errors depending on query param `type`.
 * Examples:
 *   /api/test-error?type=validation
 *   /api/test-error?type=notfound
 *   /api/test-error?type=external
 *   /api/test-error?type=unexpected
 *   /api/test-error            -> no error (success)
 */
export async function testErrorHandler(req, res) {
  const t = (req.query.type || "").toLowerCase();

  if (t === "validation") {
    // simulate a business rule validation failure
    throw new ValidationError("Invalid input: name is required", { field: "name" });
  }

  if (t === "notfound") {
    // simulate a missing resource
    throw new NotFoundError("Order 123 not found");
  }

  if (t === "external") {
    // simulate a downstream/external service failure (Stripe, DB, etc.)
    throw new ExternalServiceError("Failed to reach Firebase: connection timeout");
  }

  if (t === "unexpected") {
    // simulate an unexpected programming error
    throw new Error("unexpected null pointer");
  }

  // no error: return a simple success object (wrapper will send JSON)
  return { ok: true, message: "no error triggered", type: t || "none" };
}
