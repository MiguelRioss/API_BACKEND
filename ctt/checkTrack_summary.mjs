// /lib/checkTrackingSummary.mjs
import puppeteer from "puppeteer-core";

export async function checkTrackingSummary(input) {
  // Caminho do Chromium definido no Dockerfile/Render
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium";

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--no-zygote",
    ],
    protocolTimeout: 60_000,
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  const buildUrl = (v) =>
    /^https?:\/\//i.test(v)
      ? v
      : `https://appserver.ctt.pt/CustomerArea/PublicArea_Detail?ObjectCodeInput=${encodeURIComponent(v)}&SearchInput=${encodeURIComponent(v)}&IsFromPublicArea=true`;

  const url = buildUrl(String(input).trim());

  // Estrutura default do summary
  let summary = {
    delivered: { status: false, date: null, time: null },
    acceptedInCtt: { status: false, date: null, time: null },
    accepted: { status: false, date: null, time: null },
    in_transit: { status: false, date: null, time: null },
    waitingToBeDelivered: { status: false, date: null, time: null },
  };

  try {
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });

    summary = await page.evaluate(() => {
      const extractDateTime = (text) => {
        const dateMatch = text.match(/\d{1,2}[-/ ](?:\d{1,2}|\w+)[-/ ]\d{2,4}/);
        const timeMatch = text.match(/\b\d{1,2}[:h]\d{2}\b/);
        return {
          date: dateMatch ? dateMatch[0] : null,
          time: timeMatch ? timeMatch[0] : null,
        };
      };

      const summary = {
        delivered: { status: false, date: null, time: null },
        acceptedInCtt: { status: false, date: null, time: null },
        accepted: { status: false, date: null, time: null },
        in_transit: { status: false, date: null, time: null },
        waitingToBeDelivered: { status: false, date: null, time: null },
      };

      const KEYWORDS = [
        { re: /entregue/i, key: "delivered" },
        { re: /\baceite nos ctt\b/i, key: "acceptedInCtt" },
        { re: /\baceite\b/i, key: "accepted" },
        { re: /\bem\s*tr[aâ]ns[ií]to\b|\bem transito\b/i, key: "in_transit" },
        { re: /aguarda.*entrega/i, key: "waitingToBeDelivered" },
      ];

      const allTextNodes = Array.from(document.querySelectorAll("*"))
        .map((el) => el.textContent?.trim())
        .filter(Boolean);

      for (const text of allTextNodes) {
        for (const { re, key } of KEYWORDS) {
          if (re.test(text)) {
            const { date, time } = extractDateTime(text);
            summary[key] = { status: true, date, time };
          }
        }
      }

      return summary;
    });
  } finally {
    try { await page.close(); } catch {}
    try { await browser.close(); } catch {}
  }

  return summary;
}
