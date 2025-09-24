// /lib/checkTrackingByDateLeft.mjs
export async function checkTrackingByDateLeft(input) {
  const puppeteer = await (async () => {
    try { return (await import("puppeteer")).default; } catch {}
    try { return (await import("puppeteer-core")).default; } catch {}
    throw new Error("Install puppeteer (dev) or puppeteer-core.");
  })();

  async function launchBrowser() {
    // Prefer Sparticuz Chromium on Vercel
    if (process.env.VERCEL) {
      try {
        const chromMod = await import("@sparticuz/chromium");
        const chromium = chromMod.default ?? chromMod;
        const executablePath =
          typeof chromium.executablePath === "function"
            ? await chromium.executablePath()
            : chromium.executablePath;

        return puppeteer.launch({
          args: [
            ...chromium.args,
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--no-zygote",
          ],
          defaultViewport: chromium.defaultViewport,
          executablePath,
          headless: chromium.headless,
          protocolTimeout: 60_000,
        });
      } catch {}
    }

    // Local / generic
    return puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      channel: process.env.PUPPETEER_CHANNEL || undefined,
      protocolTimeout: 60_000,
    });
  }

  const buildUrl = (v) =>
    /^https?:\/\//i.test(v)
      ? v
      : `https://appserver.ctt.pt/CustomerArea/PublicArea_Detail?ObjectCodeInput=${encodeURIComponent(v)}&SearchInput=${encodeURIComponent(v)}&IsFromPublicArea=true`;

  const url = buildUrl(String(input).trim());

  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  let label = "unknown";
  try {
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });

    label = await page.evaluate(() => {
      const KEYWORDS = [
        { re: /entregue/i, out: "Entregue" },
        { re: /\bem\s*tr[aâ]ns[ií]to\b/i, out: "Em trânsito" },
        { re: /\bem\s*transito\b/i, out: "Em trânsito" },
        { re: /em espera/i, out: "Em espera" },
        { re: /\baceite\b/i, out: "Aceite" },
        { re: /aguarda entrada nos ctt/i, out: "Aguarda entrada nos CTT" },
      ];

      const MONTH = /Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez|Jan\.|Feb|Mar\.|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|[A-Za-z]{3,}/i;
      const DAY_MONTH = new RegExp(`\\b\\d{1,2}\\s*(?:${MONTH.source})\\b`, "i");
      const TIME = /\b\d{1,2}h\d{2}\b/i;
      const DATE_OR_TIME = new RegExp(`${DAY_MONTH.source}|${TIME.source}`, "i");
      const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

      const status = [];
      for (const el of document.querySelectorAll("*")) {
        const t = text(el);
        if (!t || t.length > 120) continue;
        for (const k of KEYWORDS) {
          if (k.re.test(t)) {
            const r = el.getBoundingClientRect?.();
            if (!r || (r.width === 0 && r.height === 0)) break;
            status.push({ el, label: k.out, rect: r });
            break;
          }
        }
      }
      if (!status.length) return "unknown";

      function hasLeftDate(el, rect) {
        let anc = el;
        for (let i = 0; i < 4 && anc?.parentElement; i++) anc = anc.parentElement;
        const nodes = anc ? anc.querySelectorAll("*") : document.querySelectorAll("*");
        for (const n of nodes) {
          const t = text(n);
          if (!t || t.length > 30) continue;
          if (!DATE_OR_TIME.test(t)) continue;
          const r = n.getBoundingClientRect?.();
          if (!r) continue;
          const left = r.right <= rect.left + 6;
          const overlap = !(r.bottom < rect.top || r.top > rect.bottom);
          if (left && overlap) return true;
        }
        return false;
      }

      const withLeft = status.filter((c) => hasLeftDate(c.el, c.rect));
      const pick = (withLeft.length ? withLeft : status).sort((a, b) => a.rect.top - b.rect.top)[0];
      return pick?.label || "unknown";
    });
  } finally {
    try { await page.close(); } catch {}
    try { await browser.close(); } catch {}
  }

  return label;
}
