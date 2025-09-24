// scripts/test-write-hardcoded-b64.mjs
// WARNING: This file contains a hardcoded service-account. DO NOT commit or deploy.
// Replace the placeholder value below with your base64 string for testing only.

import 'dotenv/config';
import admin from 'firebase-admin';

const SERVICE_ACCOUNT_BASE64= "ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAic3RvcmFnZXByb2R1Y3RzLWJiZTMwIiwKICAicHJpdmF0ZV9rZXlfaWQiOiAiNDVlN2ZlNDVkN2JmYWQ4NmYwMDc4MzhmOTUwNzk3ODE3Y2E0ZGVhNyIsCiAgInByaXZhdGVfa2V5IjogIi0tLS0tQkVHSU4gUFJJVkFURSBLRVktLS0tLVxuTUlJRXZBSUJBREFOQmdrcWhraUc5dzBCQVFFRkFBU0NCS1l3Z2dTaUFnRUFBb0lCQVFDdVV5MFAxTExJZGNCMVxuM2lGU1ZjVGZ5aHZ1Q2NkcFQ1Wk11QWZYZGt2akpDaWxadXJoZFRoVDh4Z0ttTVhsMTBXdmNTenQ2YjdweEMwalxuaWp0c09ra1YxZ1Jqb3ByVllZRlZOWnNVQWZnaU5wVGE0MXYxL3hLSUZXUE80Y1dhOUZweTZ1M292R2tBM29PN1xubXhiWVNoclpuek94NHh3R2hqZDh0eWFmZ01XeGlBSmVEWW9vMThYNnZzQ1BzT3E0U0xncU1SYnEwV01NOXlHdVxuNnhGYmxMZnhwWGdMZXNxYyt1OW5HUUNQYncxNytzS3ljUzlRemtoMlhIUk5pNGwzaUF6SS80TGpCY3BPVVJDMVxuYzN3VFpPcTJzVVZHNEw2ZS9kWFNKVFVVek5KTis2c1Y0NE95YXdORUNUbDlmaUJ6VUVXUlljOFc0OEhwMkM5K1xuSFlwWm5yTVJBZ01CQUFFQ2dnRUFOVWhnRkNBbm0wVCtsQ2hXbUFOMlB3N1lGWnh3a3B4TWJOdXRMZXJQRERqUFxub2FyQTdUTzJpVlpheVZaajJyby9adjRaUlFqMm5SNGt5K0dqQXhRWHBiQjZPL2dHQ21XWXNmSkdHY24yVFlMUVxuWWMwdm5ST2ZWdS91eDF2VDJlYUpST25RMlJ2Sm5vWGt6dkY2L0pZOStibURCQUxPWEtJbWtKeXNsZ0UycStuTVxuTUJXRkgrNkR3VWZEa05ka1VjbitWcXZnZU1UL3Q5SzJEUnJCdVl2bjR4WkRPYlFVSEpKcDhwcld5bElhd2ZJeFxuNHlFc1BzY3RwbzhSTWp5MFJ0YkJoZThRc21jKzV2eE5hMldpV29jSm94N3R0RkJkQ3pDZ09Qa1l4R3UvRFJUSlxuUy9FV2dTaE1ML3NwVWRiZTVwMnpMMDVHbVhuODdJZm4wL29iQ0xDMFp3S0JnUURxczVjUCtMTWNvdzUxdkNOSlxuc09Ta0hZT3VUbkVWMjNhSmJYUjUvalhTMnpaNWgwTjRQWlVyNDErUlVNeEc4QXA0dEhJK2tRSEUrTm5BaGYyR1xuQmFQSWdzVVA5TDdpdkMzYS85Yzlpc3NSeWtLZVlnaXIremJhSm5rMkZYeFUyTVZ1SEx6cUY5KytvKzlDOE5vd1xuY0VoeTNBMkpXcDZOdUhoa0RMTS9DRkhNY3dLQmdRQytKUFlyemFkQnNhcERITVVJdXBSMGM4N2xmbTd0b2xmVlxudjVpOXc2MmpqeFlnR0pTRDFDMzkrM0xzUmtYdHhoZ1RMTmIzY2sxKzBwVllSek9OQzVOYVNxZkpGSTJzOC9paVxuaHdpTTdGc0xncnFrcmc1TXRGVFk0RW4xWitLeTFDeStpZi9UbWh5dDd6S3VrUlhaRFk5VW9vTG1wbVBia0hCL1xuOG9zNzg5QUZhd0tCZ0gyMzMwWWw0TU9KTURpdW8zUll0ZENYSXE4ZXc0S0N3VGNTRTE4NVpWbGlKUWJxQnFFRVxuMDcvamxwQi9hRHpqWGFpVWQ5RzkyT1hLcXRGdXRJT3l4NjJqSnEzS1d1bVhCVFVXOEJPK0lkS1F0aWlpdUtSdVxuOTAzWlovb3BmaVR3ektpVDZqbTJ1aG9qTkFsMmZGbVArNjdTNHNsZGFpcmQwbGM5V2xKOFFWeXpBb0dBZC9oT1xuTWhrUnZNdGlSL0h4QjY3aFdCQnhyQzczd291NXE2MjFxNVc1Q3dlT3lEVjZEeXRpMFd0RGVYeGxScjdFRmVVbVxueFAyams2OCtkM0tGUGlyZGtBeW1qS0toT1V5OXhaNDVjT0Q0R08wazRoN0grdkdVenpuRXNFZ1pxd2RnSytCYVxuUDZKdkVmZG9IT2lCeG05ZHplS3pnTi9mQlh1KzM1dWk2ZkxOZjMwQ2dZQnZla3NNbllybXZmZWJuUUQ4d2owU1xuSU9oTUxRd25mVWdsbEZlNXZER09FUXNQdEFBNURtRy96THZpV3l1c3doT1VCSUpxbUVYRWxrV1BYaENHbGNYZlxuYTkyQmROWlppbFo3a0lZSkp4Tm5IMEUxYkRVMnMyK2JSeWt3eCtIUUJuTW83bDREbEN0VGhCWm9XaUdDOEs2Y1xuemx6ZmJsR09ZZncxRm5wUkFoYWZIdz09XG4tLS0tLUVORCBQUklWQVRFIEtFWS0tLS0tXG4iLAogICJjbGllbnRfZW1haWwiOiAiZmlyZWJhc2UtYWRtaW5zZGstZmJzdmNAc3RvcmFnZXByb2R1Y3RzLWJiZTMwLmlhbS5nc2VydmljZWFjY291bnQuY29tIiwKICAiY2xpZW50X2lkIjogIjEwMTkwNjMzMDA1MzYyNzcyMDk1MCIsCiAgImF1dGhfdXJpIjogImh0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbS9vL29hdXRoMi9hdXRoIiwKICAidG9rZW5fdXJpIjogImh0dHBzOi8vb2F1dGgyLmdvb2dsZWFwaXMuY29tL3Rva2VuIiwKICAiYXV0aF9wcm92aWRlcl94NTA5X2NlcnRfdXJsIjogImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL29hdXRoMi92MS9jZXJ0cyIsCiAgImNsaWVudF94NTA5X2NlcnRfdXJsIjogImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL3JvYm90L3YxL21ldGFkYXRhL3g1MDkvZmlyZWJhc2UtYWRtaW5zZGstZmJzdmMlNDBzdG9yYWdlcHJvZHVjdHMtYmJlMzAuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJ1bml2ZXJzZV9kb21haW4iOiAiZ29vZ2xlYXBpcy5jb20iCn0K"
const FIREBASE_DATABASE_URL = 'https://storageproducts-bbe30-default-rtdb.europe-west1.firebasedatabase.app'; // adjust if needed

function loadSaFromB64(b64) {
  if (!b64 || b64.trim().length === 0) throw new Error('No base64 provided.');
  try {
    const s = Buffer.from(b64, 'base64').toString('utf8').trim();
    return JSON.parse(s);
  } catch (err) {
    throw new Error('Failed to decode/parse provided base64 service account: ' + err.message);
  }
}

function init() {
  const sa = loadSaFromB64(SERVICE_ACCOUNT_BASE64);
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    databaseURL: FIREBASE_DATABASE_URL,
  });
  console.info('[hard-b64] initialized admin (project_id=%s)', sa.project_id || '<no-project-id>');
}

async function run() {
  try {
    init();
    const db = admin.database();
    const ref = db.ref('/orders/test_hardcoded_b64_' + Date.now());
    console.info('[hard-b64] attempting set to', ref.toString());
    await ref.set({ test: true, ts: new Date().toISOString() });
    console.log('[hard-b64] write OK');
    process.exit(0);
  } catch (err) {
    console.error('[hard-b64] write FAILED ->', {
      message: err && err.message,
      code: err && err.code,
      status: err && err.status,
      stack: err && err.stack ? err.stack.split('\n').slice(0,8).join('\n') : undefined,
    });
    process.exit(1);
  }
}

run();
