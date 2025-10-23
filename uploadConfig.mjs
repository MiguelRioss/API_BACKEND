import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  initFirebase,
  getFirestore,
  getRealtimeDB,
  useRealtimeDB,
} from "./database/firebase/firebaseInit.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(__dirname, "mesodoseConfig.json");

async function loadConfig() {
  const raw = await fs.readFile(CONFIG_PATH, "utf8");
  return JSON.parse(raw);
}

async function uploadConfig() {
  const config = await loadConfig();

  initFirebase();

  if (useRealtimeDB()) {
    const db = getRealtimeDB();
    await db.ref("/site_config/mesodoseConfig").set(config);
  } else {
    const firestore = getFirestore();
    await firestore.collection("site_config").doc("mesodoseConfig").set(config);
  }

  console.log("Config uploaded successfully!");
}

uploadConfig().catch((err) => {
  console.error("Failed to upload config:", err);
  process.exitCode = 1;
});
