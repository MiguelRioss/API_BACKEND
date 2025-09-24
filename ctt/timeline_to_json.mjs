// ctt/timeline_to_json.mjs
import { devices } from "playwright";
import { getBrowser } from "./browserPool.mjs";

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

function installRequestBlocking(context) {
  context.route("**/*", (route) => {
    const req = route.request();
    const type = req.resourceType();
    const url  = req.url();
    if (["image","font","media","stylesheet"].includes(type)) return route.abort();
    if (/googletagmanager|google-analytics|doubleclick|adnxs|clarity|hotjar|facebook/i.test(url)) return route.abort();
    return route.continue();
  });
}

export async function timelineToJson(pageUrl) {
  const browser = await getBrowser();

  const context = await browser.newContext({
    ...DEVICE,
    userAgent: UA,
    locale: "pt-PT",
    timezoneId: "Europe/Lisbon",
  });
  context.setDefaultNavigationTimeout(20_000);
  context.setDefaultTimeout(15_000);

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  installRequestBlocking(context);

  const page = await context.newPage();
  try {
    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await dismissCookies(page);

    await page.waitForSelector("#reactContainer", { state: "attached", timeout: 12_000 }).catch(() => {});
    await page.waitForSelector("div[data-container]", { state: "attached", timeout: 15_000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(200);

    const events = await page.evaluate(() => {
      const dateRe = /\b([0-3]?\d)\s*(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\b/i;
      const timeRe = /\b([01]?\d|2[0-3])h[0-5]\d\b/i;
      const root = document.querySelector("#Timeline2") || document;
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

      const uniq = new Map();
      for (const r of results) {
        const key = `${r.date}|${r.title}`;
        if (!uniq.has(key)) uniq.set(key, r);
      }
      return Array.from(uniq.values());
    });

    return events;
  } finally {
    await context.close().catch(() => {});
  }
}

// CLI support (optional)
if (import.meta.url === `file://${process.argv[1]}`) {
  const urlArg = process.argv[2];
  if (!urlArg) { console.error("Usage: node timeline_to_json.mjs <URL>"); process.exit(2); }
  const out = await timelineToJson(urlArg);
  console.log(JSON.stringify(out, null, 2));
}
