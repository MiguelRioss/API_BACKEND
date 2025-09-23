// api/utils/httpResponses.mjs
export function resSuccess(res, data = null, { status = 200 } = {}) {
  // Standard success envelope
  return res.status(status).json({ ok: true, data });
}


//Main FUNCTION CALLED BY http Erros, error default mensage 
export function resError(res, { code = "ERROR", message = "An error occurred", details = null }, { status = 400 } = {}) {
  // Standard error envelope
  const body = { ok: false, error: { code, message } };
  if (details) body.error.details = details;
  return res.status(status).json(body);
}

