// middleware/cors.mjs
export default function createCorsMiddleware() {
  const allowList = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return function cors(req, res, next) {
    const origin = req.headers.origin;
    const hasAllowList = allowList.length > 0;

    if (!hasAllowList) {
      // no list: allow everyone (no credentials)
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (origin && allowList.includes(origin)) {
      // matched: echo origin + allow credentials
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  };
}
