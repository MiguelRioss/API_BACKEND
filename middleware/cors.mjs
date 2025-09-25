// middleware/cors.mjs
export default function createCorsMiddleware() {
  const allowList = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return function cors(req, res, next) {
    const origin = req.headers.origin;

    // If you define CORS_ORIGINS, allow only those; otherwise allow all (no creds).
    let allowOrigin = '*';
    if (allowList.length > 0 && origin && allowList.includes(origin)) {
      allowOrigin = origin;            // echo the matched origin
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Vary', 'Origin');    // important for caches/CDNs
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    next();
  };
}
