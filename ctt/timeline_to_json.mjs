// ctt/timeline_to_json.mjs
import { devices } from "playwright";
import { getBrowser } from "./browserPool.mjs";

const DEVICE = devices["iPhone 12 Pro"];
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";

const CACHE_TTL_MS = 120_000;
const MAX_CACHE_SIZE = 64;

const timelineCache = new Map();
const timelineInFlight = new Map();

let sharedContext = null;
let sharedContextPromise = null;

function cloneEvents(events) {
  return events.map((item) => ({ ...item }));
}

function pruneCache(now, ttl) {
  if (ttl <= 0) {
    timelineCache.clear();
    return;
  }

  for (const [key, entry] of timelineCache.entries()) {
    if (now - entry.ts > ttl) {
      timelineCache.delete(key);
    }
  }

  if (timelineCache.size <= MAX_CACHE_SIZE) return;

  const ordered = Array.from(timelineCache.entries()).sort((a, b) => a[1].ts - b[1].ts);
  while (ordered.length > MAX_CACHE_SIZE) {
    const [key] = ordered.shift();
    timelineCache.delete(key);
  }
}

async function ensureContext() {
  if (sharedContext && !sharedContext._isClosed) {
    return sharedContext;
  }

  if (!sharedContextPromise) {
    sharedContextPromise = (async () => {
      const browser = await getBrowser();
      const context = await browser.newContext({
        ...DEVICE,
        userAgent: UA,
        locale: "pt-PT",
        timezoneId: "Europe/Lisbon",
      });

      context._isClosed = false;
      context.on("close", () => {
        context._isClosed = true;
        if (sharedContext === context) {
          sharedContext = null;
        }
      });

      context.setDefaultNavigationTimeout(20_000);
      context.setDefaultTimeout(15_000);

      await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      });

      installRequestBlocking(context);
      sharedContext = context;
      return context;
    })();
  }

  try {
    return await sharedContextPromise;
  } finally {
    sharedContextPromise = null;
  }
}

async function dismissCookies(page) {
  const sels = [
    "#onetrust-reject-all-handler",
    "#onetrust-accept-btn-handler",
    'button:has-text("Rejeitar cookies opcionais")',
    'button:has-text("Aceitar todos os cookies")',
  ];
  for (const s of sels) {
    const b = page.locator(s).first();
    if (await b.count()) {
      await b.click({ timeout: 1500 }).catch(() => {});
      break;
    }
  }
  await page.evaluate(() => {
    const el = document.getElementById("onetrust-banner-sdk");
    if (el) el.style.setProperty("display", "none", "important");
  });
}

function installRequestBlocking(context) {
  if (context._cttBlockerInstalled) return;
  context._cttBlockerInstalled = true;

  context.route("**/*", (route) => {
    const req = route.request();
    const type = req.resourceType();
    const url = req.url();
    if (["image", "font", "media", "stylesheet"].includes(type)) return route.abort();
    if (/googletagmanager|google-analytics|doubleclick|adnxs|clarity|hotjar|facebook/i.test(url)) return route.abort();
    return route.continue();
  });
}

export async function timelineToJson(pageUrl, options = {}) {
  const targetUrl = (typeof pageUrl === "string" ? pageUrl : String(pageUrl ?? "")).trim();
  if (!targetUrl) {
    throw new Error("timelineToJson requires a non-empty URL");
  }
  const key = targetUrl;
  const ttlValue = Number.isFinite(options.cacheTtlMs)
    ? Math.max(0, Number(options.cacheTtlMs))
    : CACHE_TTL_MS;
  const useCache = ttlValue > 0;
  const now = Date.now();

  if (useCache) {
    pruneCache(now, ttlValue);
    const cached = timelineCache.get(key);
    if (cached && now - cached.ts <= ttlValue) {
      return cloneEvents(cached.data);
    }
    if (timelineInFlight.has(key)) {
      const shared = await timelineInFlight.get(key);
      return cloneEvents(shared);
    }
  }

  const task = (async () => {
    const context = await ensureContext();
    const page = await context.newPage();
    try {
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await dismissCookies(page);

      await Promise.all([
        page.waitForSelector("#reactContainer", { state: "attached", timeout: 12_000 }).catch(() => {}),
        page.waitForSelector("div[data-container]", { state: "attached", timeout: 15_000 }),
      ]);
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(100);

      const events = await page.evaluate(() => {
        const dateRe = /\b([0-3]?\d)\s*(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\b/i;
        const timeRe = /\b([01]?\d|2[0-3])h[0-5]\d\b/i;
        const root = document.querySelector("#Timeline2") || document;
        const containers = Array.from(root.querySelectorAll("div[data-container]"));
        const clean = (value) => (value || "").replace(/\s+/g, " ").trim();

        const nextText = (container, startNode) => {
          const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
            {
              acceptNode(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                  const t = clean(node.nodeValue);
                  if (t && !dateRe.test(t) && !timeRe.test(t)) return NodeFilter.FILTER_ACCEPT;
                  return NodeFilter.FILTER_SKIP;
                }
                const tag = node.nodeType === 1 ? node.tagName.toLowerCase() : "";
                if (["h1", "h2", "h3", "strong", "b", "label"].includes(tag)) return NodeFilter.FILTER_ACCEPT;
                return NodeFilter.FILTER_SKIP;
              },
            }
          );

          let cursor = startNode;
          while (cursor && cursor !== container && !cursor.nextSibling) cursor = cursor.parentNode;
          walker.currentNode = cursor || container;

          let step = walker.nextNode();
          while (step) {
            const txt = step.nodeType === Node.TEXT_NODE ? step.nodeValue : step.textContent;
            const cleanTxt = clean(txt);
            if (cleanTxt) return cleanTxt;
            step = walker.nextNode();
          }

          let fallback = "";
          container.querySelectorAll("*").forEach((el) => {
            const t = clean(el.textContent);
            if (t.length > fallback.length) fallback = t;
          });
          return fallback;
        };

        const results = [];
        const seen = new Set();

        for (const container of containers) {
          if (!container || seen.has(container)) continue;

          const nodes = [container, ...container.querySelectorAll("*")];
          let dateNode = null;
          let dateValue = null;

          for (const node of nodes) {
            const text = clean(node.textContent || node.nodeValue);
            if (!text) continue;
            const match = text.match(dateRe);
            if (match) {
              dateNode = node;
              dateValue = match[0];
              break;
            }
          }

          if (!dateNode || !dateValue) continue;

          const containerText = clean(container.textContent);
          const timeMatch = containerText.match(timeRe);
          const dateMatch = containerText.match(dateRe);
          const date = (dateMatch || [dateValue])[0];
          const time = (timeMatch || [""])[0];
          const title = nextText(container, dateNode);

          if (!title) continue;

          seen.add(container);
          results.push({ date, time, title });
        }

        const uniq = new Map();
        for (const item of results) {
          const cacheKey = `${item.date}|${item.title}`;
          if (!uniq.has(cacheKey)) {
            uniq.set(cacheKey, item);
          }
        }
        return Array.from(uniq.values());
      });

      const normalized = events.map((event) => ({
        date: event.date,
        time: event.time,
        title: event.title,
      }));

      if (useCache) {
        timelineCache.set(key, { ts: Date.now(), data: normalized });
      }
      return normalized;
    } finally {
      await page.close().catch(() => {});
    }
  })();

  if (useCache) timelineInFlight.set(key, task);
  try {
    const fresh = await task;
    return cloneEvents(fresh);
  } finally {
    if (useCache) timelineInFlight.delete(key);
  }
}

// CLI support (optional)
if (import.meta.url === `file://${process.argv[1]}`) {
  const urlArg = process.argv[2];
  if (!urlArg) {
    console.error("Usage: node timeline_to_json.mjs <URL>");
    process.exit(2);
  }
  const out = await timelineToJson(urlArg.trim(), { cacheTtlMs: 0 });
  console.log(JSON.stringify(out, null, 2));
}
