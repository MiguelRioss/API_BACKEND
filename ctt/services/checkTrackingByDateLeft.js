// checkTrackingByDateLeft.js
// Prints one word: "Entregue", "Em trânsito", "Em espera", or "unknown"
// Heuristic: the active status line will have a date/time element to its left.

(async function () {
  // load puppeteer via require() then dynamic import()
  let puppeteer;
  try { puppeteer = require('puppeteer'); }
  catch (err) {
    try {
      const mod = await import('puppeteer');
      puppeteer = mod && mod.default ? mod.default : mod;
    } catch (err2) {
      console.error('Please install puppeteer: npm install puppeteer');
      process.exit(1);
    }
  }

  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: node checkTrackingByDateLeft.js <TRACKING_URL_OR_ID_OR_FULL_URL>');
    process.exit(1);
  }

  function buildUrl(v) {
    if (/^https?:\/\//i.test(v)) return v;
    const id = encodeURIComponent(v);
    return `https://appserver.ctt.pt/CustomerArea/PublicArea_Detail?ObjectCodeInput=${id}&SearchInput=${id}&IsFromPublicArea=true`;
  }
  const url = buildUrl(raw);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36');
    await page.setViewport({ width: 1400, height: 1000 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // allow client-side rendering
    await sleep(1400);

    const result = await page.evaluate(() => {
      // keywords and normalized outputs
      const keywords = [
        { key: 'Entregue', out: 'Entregue' },
        { key: 'Em trânsito', out: 'Em trânsito' },
        { key: 'Em transito', out: 'Em trânsito' }, // fallback
        { key: 'Em espera', out: 'Em espera' }
      ];

      // date/time regex (flexible: day + month abbrev OR hhmm format with 'h')
      const dateRegex = /\b\d{1,2}\s*(?:Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez|Jan\.|Feb|Mar\.|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|[A-Za-z]{3,})\b/i;
      const timeRegex = /\b\d{1,2}h\d{2}\b/i;
      const genericDateRegex = new RegExp(dateRegex.source + '|' + timeRegex.source, 'i');

      // Find candidate elements whose text is short and contains a keyword
      const candidates = [];
      const all = document.querySelectorAll('*');
      for (let el of all) {
        try {
          const txt = (el.textContent || '').trim();
          if (!txt) continue;
          if (txt.length > 80) continue; // ignore big containers
          for (let k of keywords) {
            if (txt.toLowerCase().indexOf(k.key.toLowerCase()) !== -1) {
              // candidate: record node and keyword
              candidates.push({ el, keyword: k.key, out: k.out, text: txt });
              break;
            }
          }
        } catch (e) { /* ignore */ }
      }

      if (!candidates.length) return 'unknown';

      // Helper to find any element that is mostly left of the candidate and matches date/time regex
      function hasDateToLeft(candidateEl) {
        try {
          const candRect = candidateEl.getBoundingClientRect();
          if (!candRect || (candRect.width === 0 && candRect.height === 0)) return false;

          // Search within the nearest container (ancestor) for potential date nodes to the left
          // choose ancestor that likely groups timeline item (up to 4 levels)
          let ancestor = candidateEl;
          for (let i = 0; i < 4 && ancestor.parentElement; i++) ancestor = ancestor.parentElement;

          // gather candidate siblings / children to scan
          const nodesToCheck = Array.from(ancestor.querySelectorAll('*')).slice(0, 800);

          for (let n of nodesToCheck) {
            try {
              const nt = (n.textContent || '').trim();
              if (!nt) continue;
              // quick length guard: date texts are short
              if (nt.length > 20) continue;
              if (!genericDateRegex.test(nt)) continue;

              const nRect = n.getBoundingClientRect();
              if (!nRect) continue;
              // consider it "left" when its right edge is left of candidate's left edge (allow small overlap)
              if (nRect.right <= candRect.left + 6) {
                // also ensure vertical overlap (same row roughly)
                const vertOverlap = !(nRect.bottom < candRect.top || nRect.top > candRect.bottom);
                if (vertOverlap) return true;
              }
            } catch (e) { /* ignore node errors */ }
          }

          // fallback: also check immediate previousElementSibling chain for date-like text
          let prev = candidateEl.previousElementSibling;
          for (let i = 0; i < 6 && prev; i++) {
            try {
              const pt = (prev.textContent || '').trim();
              if (pt && genericDateRegex.test(pt) && pt.length < 30) return true;
            } catch(e){}
            prev = prev.previousElementSibling;
          }
        } catch (e) { /* ignore */ }
        return false;
      }

      // Evaluate candidates: prefer one that has a date to the left
      for (let c of candidates) {
        try {
          if (hasDateToLeft(c.el)) return c.out;
        } catch (e) { /* ignore */ }
      }

      // If none found with date-left, fallback: if any candidate has class names indicating active/current pick it
      const activeClassRe = /(active|current|selected|is-active|--active)/i;
      for (let c of candidates) {
        try {
          let cur = c.el;
          let depth = 0;
          while (cur && depth++ < 6) {
            if (cur.className && typeof cur.className === 'string' && activeClassRe.test(cur.className)) return c.out;
            cur = cur.parentElement;
          }
        } catch(e){}
      }

      // Soft fallback: if only one candidate or if a candidate contains an icon element with green fill, return it
      if (candidates.length === 1) return candidates[0].out;

      // no reliable detection
      return 'unknown';
    });

    console.log(result);
    await browser.close();
    process.exit(0);
  } catch (err) {
    if (browser) try { await browser.close(); } catch(_) {}
    console.log('unknown');
    process.exit(0);
  }
})();
