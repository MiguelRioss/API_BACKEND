// timeline_to_json.mjs
// Exported API:
//   - async function timelineToJson(pageUrl?: string): Promise<Array<{date, time, title}>>
//
// When run directly (node timeline_to_json.mjs [URL]) it will still print the JSON,
// but when imported it RETURNS the JSON instead of writing to stdout.

import { chromium, devices } from "playwright";

const DEVICE = devices["iPhone 12 Pro"];
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";

async function dismissCookies(page) {
  const sels = [
    "#onetrust-reject-all-handler",
    "#onetrust-accept-btn-handler",
    'button:has-text("Rejeitar cookies opcionais")',
    'button:has-text("Aceitar todos os cookies")',
  ];
  for (const s of sels) {
    const b = page.locator(s).first();
    if (await b.count()) { await b.click({ timeout: 1500 }).catch(() => {}); break; }
  }
  await page.evaluate(() => {
    const el = document.getElementById("onetrust-banner-sdk");
    if (el) el.style.setProperty("display", "none", "important");
  });
}

/**
 * Launches a headless browser, navigates to the CTT detail page,
 * and returns the raw timeline event list as JSON.
 */
export async function timelineToJson(pageUrl) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  try {
    const context = await browser.newContext({
      ...DEVICE,
      userAgent: UA,
      locale: "pt-PT",
      timezoneId: "Europe/Lisbon",
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const page = await context.newPage();
    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await dismissCookies(page);

    // Wait for SPA content
    await page.waitForSelector("#reactContainer", { state: "attached", timeout: 20_000 }).catch(() => {});
    await page.waitForSelector("div[data-container]", { state: "attached", timeout: 25_000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(400);

    // Extract events to JSON (same logic you had)
    const events = await page.evaluate(() => {
      const dateRe = /\b([0-3]?\d)\s*(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\b/i;
      const timeRe = /\b([01]?\d|2[0-3])h[0-5]\d\b/i;

      const root = document.querySelector("#Timeline2") || document; // narrow if present
      const all = Array.from(root.querySelectorAll("*"));
      const seen = new Set();
      const results = [];

      const nextText = (container, startNode) => {
        const walker = document.createTreeWalker(
          container,
          NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
          {
            acceptNode(node) {
              if (node.nodeType === Node.TEXT_NODE) {
                const t = node.nodeValue.replace(/\s+/g, " ").trim();
                if (t && !dateRe.test(t) && !timeRe.test(t)) return NodeFilter.FILTER_ACCEPT;
                return NodeFilter.FILTER_SKIP;
              }
              const tag = node.nodeType === 1 ? node.tagName.toLowerCase() : "";
              if (["h1","h2","h3","strong","b","label"].includes(tag)) return NodeFilter.FILTER_ACCEPT;
              return NodeFilter.FILTER_SKIP;
            }
          }
        );
        let n = startNode;
        while (n && n !== container && !n.nextSibling) n = n.parentNode;
        walker.currentNode = n || container;
        let step = walker.nextNode();
        while (step) {
          const txt = (step.nodeType === Node.TEXT_NODE ? step.nodeValue : step.textContent) || "";
          const clean = txt.replace(/\s+/g, " ").trim();
          if (clean) return clean;
          step = walker.nextNode();
        }
        // fallback: longest text in container
        let best = "";
        container.querySelectorAll("*").forEach(el => {
          const t = (el.textContent || "").replace(/\s+/g, " ").trim();
          if (t.length > best.length) best = t;
        });
        return best;
      };

      for (const el of all) {
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        const mDate = text.match(dateRe);
        if (!mDate) continue;

        const container = el.closest('div[data-container]') || el.parentElement || el;
        if (!container || seen.has(container)) continue;

        const date = (container.textContent.match(dateRe) || [])[0] || mDate[0];
        const time = (container.textContent.match(timeRe) || [""])[0];
        const title = nextText(container, el);

        seen.add(container);
        results.push({ date, time, title });
      }

      // de-duplicate by date+title
      const uniq = new Map();
      for (const r of results) {
        const key = `${r.date}|${r.title}`;
        if (!uniq.has(key)) uniq.set(key, r);
      }
      return Array.from(uniq.values());
    });

    await browser.close();
    return events; // <-- return the array to the caller
  } catch (err) {
    await browser.close();
    throw err; // let the caller decide how to handle errors
  }
}

/* Optional: allow CLI usage without changing imports
   node timeline_to_json.mjs [URL]
*/
if (import.meta.url === `file://${process.argv[1]}`) {
  const urlArg = process.argv[2] || DEFAULT_URL;
  timelineToJson(urlArg)
    .then((events) => {
      // Print ONLY when executed directly
      process.stdout.write(JSON.stringify(events, null, 2) + "\n");
    })
    .catch((err) => {
      console.error(err);
      process.stdout.write("[]\n");
      process.exit(1);
    });
}
