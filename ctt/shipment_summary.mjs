// shipment_summary.mjs
// Exported API:
//   async function getShipmentSummaryByCode(rtCode: string): Promise<Summary>
//
// Summary shape:
// {
//   delivered:               { status: boolean, date: string|null, time: string|null },
//   acceptedInCtt:           { status: boolean, date: string|null, time: string|null },
//   accepted:                { status: boolean, date: string|null, time: string|null },
//   in_traffic:              { status: boolean, date: string|null, time: string|null },
//   wating_to_Be_Delivered:  { status: boolean, date: string|null, time: string|null }
// }

import { getPairedTimeline } from "./jsonTimeLines.mjs";

// Build the CTT detail URL from an RT code
function buildCttUrl(code) {
  const rt = String(code).trim().toUpperCase();
  // minimal sanity check; relax/tighten as you wish
  if (!/^RT[0-9A-Z]{6,}PT$/.test(rt)) {
    throw new Error(`Invalid RT code: "${code}"`);
  }
  const q = new URLSearchParams({
    ObjectCodeInput: rt,
    SearchInput: rt,
    IsFromPublicArea: "true",
  });
  return `https://appserver.ctt.pt/CustomerArea/PublicArea_Detail?${q.toString()}`;
}

const PT_MONTHS = {
  Jan: 1, Fev: 2, Mar: 3, Abr: 4, Mai: 5, Jun: 6,
  Jul: 7, Ago: 8, Set: 9, Out: 10, Nov: 11, Dez: 12
};

const toStamp = (dateStr = "", timeStr = "") => {
  const [dStr, monStr] = (dateStr || "").trim().split(/\s+/);
  const dd = parseInt(dStr || "1", 10);
  const mm = PT_MONTHS[monStr] || 1;
  const [hh, mi] = (timeStr || "00h00").split("h").map(x => parseInt(x || "0", 10));
  const y = new Date().getFullYear(); // adjust if your timelines can cross years
  return new Date(y, mm - 1, dd, hh || 0, mi || 0).getTime();
};

const norm = (s = "") =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

const titleToKey = (title = "") => {
  const t = norm(title);
  if (t === "entregue") return "delivered";
  if (t === "aguarda entrada nos ctt") return "acceptedInCtt";
  if (t === "aceite") return "accepted";
  if (t === "em transito") return "in_traffic";              // “trânsito” sans accent
  if (t === "em espera") return "wating_to_Be_Delivered";    // keep your naming
  return null;
};

const makeEntry = (record) => ({
  status: Boolean(record),
  date: record?.date ?? null,
  time: record?.time ?? null,
});

/** Public API: pass an RT code (e.g., "RT160147615PT"); returns the summary object. */
export async function getShipmentSummaryByCode(rtCode) {
  const url = buildCttUrl(rtCode);
  const eventsObjClean = await getPairedTimeline(url); // [{ date, time, message }, …]

  // Pick most recent occurrence per status-key
  const latestByKey = {};
  for (const ev of eventsObjClean) {
    const key = titleToKey(ev.message);
    if (!key) continue;
    const stamp = toStamp(ev.date, ev.time);
    const cur = latestByKey[key];
    if (!cur || stamp > cur._stamp) {
      latestByKey[key] = { date: ev.date, time: ev.time, _stamp: stamp };
    }
  }

  // Base summary
  const summary = {
    delivered:              makeEntry(latestByKey["delivered"]),
    acceptedInCtt:          makeEntry(latestByKey["acceptedInCtt"]),
    accepted:               makeEntry(latestByKey["accepted"]),
    in_traffic:             makeEntry(latestByKey["in_traffic"]),
    wating_to_Be_Delivered: makeEntry(latestByKey["wating_to_Be_Delivered"]),
  };

  // Rule: if delivered is true and waiting-to-be-delivered is false,
  // copy the DELIVERED DATE into waiting (time left null as per your spec).
  if (summary.delivered.status && !summary.wating_to_Be_Delivered.status) {
    summary.wating_to_Be_Delivered = summary.delivered
  }

  return summary;
}

/* Optional CLI:
   node shipment_summary.mjs RT160147615PT
*/
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: node shipment_summary.mjs <RT_CODE>");
    process.exit(2);
  }
  const summary = await getShipmentSummaryByCode(arg);
  console.log(JSON.stringify(summary, null, 2));
}
