// utils/handleFactory.mjs
import { DomainError } from '../errors/domainErros.mjs'; // optional import for instanceof checks

/**
 * Wrap an async route handler: handle errors deterministically.
 * Usage:
 *   app.get('/api/orders/:id', handleFactory(getOrderByIdAPI));
 */
export default function handleFactory(fn) {
  if (typeof fn !== 'function') {
    throw new TypeError('handleFactory expects a function');
  }

  return async function handler(req, res, next) {
    try {
      const result = await fn(req, res, next);

      if (res.headersSent) {
        return;
      }

      if (result === undefined) {
        return res.status(204).end();
      }

      if (typeof result === 'string' || Buffer.isBuffer(result)) {
        return res.send(result);
      }

      if (result !== null && typeof result === 'object') {
        if (typeof result.status === 'number' && 'body' in result) {
          return res.status(result.status).json(result.body);
        }

        return res.json(result);
      }

      return res.send(String(result));
    } catch (err) {
      // Log everything for server-side debugging
      console.error('[UNHANDLED ROUTE ERROR]', {
        path: req.path,
        method: req.method,
        constructorName: err && err.constructor && err.constructor.name,
        code: err && err.code,
        message: err && err.message,
        stackFirstLine: err && err.stack && err.stack.split('\n')[0],
        original: err && err.original
      });

      // Map known domain-level error codes -> HTTP statuses
      if (err && err.code === 'NOT_FOUND') {
        return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: err.message } });
      }

      if (err && err.code === 'VALIDATION_ERROR') {
        return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: err.message, details: err.details || null } });
      }

      if (err && err.code === 'EXTERNAL_SERVICE_ERROR') {
        return res.status(502).json({ ok: false, error: { code: 'EXTERNAL_SERVICE_ERROR', message: err.message } });
      }

      // If it's a DomainError with some other code, prefer 400/422 as you like:
      if (err instanceof DomainError) {
        return res.status(400).json({ ok: false, error: { code: err.code || 'DOMAIN_ERROR', message: err.message } });
      }

      // Unknown/unexpected -> 500 internal error
      const payload = { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } };
      // In non-production we can add debug info to response (optional)
      if (process.env.NODE_ENV !== 'production') {
        payload.error.debug = { constructorName: err && err.constructor && err.constructor.name, message: err && err.message, stack: err && err.stack };
      }
      return res.status(500).json(payload);
    }
  };
}
