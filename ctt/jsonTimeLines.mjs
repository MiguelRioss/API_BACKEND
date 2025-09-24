// get_paired_timeline.mjs
// Exported API:
//   async function getPairedTimeline(url: string): Promise<Array<{date,time,title,message}>>

import { timelineToJson } from "./timeline_to_json.mjs";

/** Build the final paired events from the raw timeline JSON. */
function buildPaired(events) {
  // exact matches to drop
  const blacklistExact = new Set([
    "Saltar para o conteúdo principal",
    "CTT",
    "window.OutSystemsApp = { basePath: '/CustomerArea/' };",
  ]);

  // filter noise & RT160-like titles
  const filtered = events.filter((e) => {
    const t = (e.title ?? "").trim();
    if (!t) return false;
    if (blacklistExact.has(t)) return false;
    if (t.toUpperCase().startsWith("RT160")) return false;
    return true;
  });
  //console.log("filter",filtered)
  const isTimeRow = (it) => Boolean(it.time) || it.title === it.date;

  // group by date (preserve original order within each date)
  const groups = new Map();
  filtered.forEach((it, idx) => {
    if (!groups.has(it.date)) groups.set(it.date, []);
    groups.get(it.date).push({ ...it, _idx: idx });
  });

  const out = [];
  for (const [date, rows] of groups) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!isTimeRow(row)) continue; // only time rows spawn an event

      // find nearest non-time row with same date (prefer previous, else next)
      let message = null;
      for (let j = i - 1; j >= 0; j--) {
        const cand = rows[j];
        if (!isTimeRow(cand)) { message = cand.title; break; }
      }
      if (!message) {
        for (let j = i + 1; j < rows.length; j++) {
          const cand = rows[j];
          if (!isTimeRow(cand)) { message = cand.title; break; }
        }
      }

      out.push({
        date,
        time: row.time || "",
        title: row.title,      // usually the date label itself (e.g., "15 Set")
        message: message || null,
      });
    }
  }
  //console.log("out",out)


  // drop any that failed to find a message
  return out.filter((e) => e.message);
}

/** Public API: pass any valid CTT detail URL; returns paired events. */
export async function getPairedTimeline(url) {
  const events = await timelineToJson(url);
  return buildPaired(events);
}

/* Optional CLI: `node get_paired_timeline.mjs <URL>` */
if (import.meta.url === `file://${process.argv[1]}`) {
  const urlArg = process.argv[2];
  if (!urlArg) {
    console.error("Usage: node get_paired_timeline.mjs <URL>");
    process.exit(2);
  }
  const data = await getPairedTimeline(urlArg);
  console.log(JSON.stringify(data, null, 2));
}
