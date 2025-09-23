// api/health.mjs
export async function health(req, res) {
  // either return a value (wrapper will send JSON), or call res.json() directly
  return { ok: true, ts: new Date().toISOString() };
}