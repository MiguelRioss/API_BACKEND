// api/debugOrders.mjs
import express from 'express';
import { createOrderDB } from '../database/firebaseDB.mjs'; // ← adjust path if needed
import { initFirebase } from '../database/firebase/firebaseInit.mjs'; // optional

const router = express.Router();

router.post('/debug/create-only-db-order', async (req, res) => {
  console.log('[DEBUG create-only-db-order] start - keys:', req.body && Object.keys(req.body));
  try {
    // optional: ensure firebase is initialized
    try { initFirebase(); console.log('[DEBUG] firebase init ok'); } catch (e) { console.warn('[DEBUG] firebase init warn', e && e.message); }

    const payload = {
      name: req.body?.name || req.body?.metadata?.full_name || 'Debug User',
      email: req.body?.email || 'debug@example.com',
      amount_total: Number(req.body?.amount_total || 100),
      currency: req.body?.currency || 'eur',
      items: Array.isArray(req.body?.items) && req.body.items.length ? req.body.items : [{ id: 'manual', name: 'Debug item', quantity: 1, unit_amount: Number(req.body?.amount_total || 100) }],
      metadata: req.body?.metadata || {}
    };

    const created = await createOrderDB(payload);
    console.log('[DEBUG create-only-db-order] created ->', created && created.id);
    return res.json({ ok: true, debug: true, order: created });
  } catch (err) {
    console.error('[DEBUG create-only-db-order] ERROR:', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'debug create failed', detail: err && err.message });
  }
});

export default router;
