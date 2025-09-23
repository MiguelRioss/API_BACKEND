// api/utils/handlerFactory.mjs
/**
 * Wrap an async/sync route handler so you don't need try/catch everywhere.
 * - fn may send a response (res.json / res.send) or return a value.
 * - If fn returns a value and no response was sent, the wrapper sends it as JSON.
 * - All errors are forwarded to next(err) so the central error middleware handles them.
 */
export function createHandler(fn) {
  return async function handler(req, res, next) {
    try {
      const result = await Promise.resolve(fn(req, res, next)); // supports sync or async
      if (res.headersSent) return; // handler already sent response
      if (typeof result !== "undefined") {
        // convenience: return a consistent envelope if you want:
        // res.json({ ok: true, data: result });
        return res.json(result);
      }
      // else, nothing to do — handler already handled response
    } catch (err) {
      // forward to central error middleware
      return next(err);
    }
  };
}
