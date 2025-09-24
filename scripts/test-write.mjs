// scripts/test-write.mjs
import 'dotenv/config';
import admin from 'firebase-admin';

function parseServiceAccountFromBase64Env() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ?? process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) return null;
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf8').trim());
}

function init() {
  // init same as your code (but minimal)
  const parsed = parseServiceAccountFromBase64Env();
  if (parsed) {
    admin.initializeApp({ credential: admin.credential.cert(parsed), databaseURL: process.env.FIREBASE_DATABASE_URL });
    console.info('[test-write] initialized admin via base64 service account (project_id=%s)', parsed.project_id);
  } else {
    admin.initializeApp({ credential: admin.credential.applicationDefault(), databaseURL: process.env.FIREBASE_DATABASE_URL });
    console.info('[test-write] initialized admin via applicationDefault()');
  }
}

async function run() {
  try {
    init();
    const db = admin.database();
    const ref = db.ref('/orders/test_write_' + Date.now());
    console.info('[test-write] attempting set to', ref.toString());
    await ref.set({ test: true, ts: new Date().toISOString() });
    console.log('[test-write] write OK');
    process.exit(0);
  } catch (err) {
    console.error('[test-write] write FAILED ->', {
      message: err && err.message,
      code: err && err.code,
      status: err && err.status,
      details: err && err.details,
      stack: err && err.stack ? err.stack.split('\n').slice(0,8).join('\n') : undefined
    });
    process.exit(1);
  }
}

run();
