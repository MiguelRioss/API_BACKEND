// ctt/browserPool.mjs
import { chromium } from "playwright";

let browserPromise = null;

export async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--no-sandbox",           // fine inside Docker / Render
      ],
    });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) {
    try { (await browserPromise).close(); } catch {}
    browserPromise = null;
  }
}
