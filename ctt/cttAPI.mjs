// ctt/cttAPI.mjs
import { checkTrackingSummary } from "./checkTrackingSummary.mjs"; // or your new file name

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function parseRt(req) {
  const rt = (req.query.rt || req.query.code || "").toString().trim().toUpperCase();
  if (!rt) throw badRequest("Missing query parameter 'rt' (e.g., ?rt=RT160147615PT)");
  if (!/^RT[0-9A-Z]{6,}PT$/.test(rt)) throw badRequest("Invalid RT code format.");
  return rt;
}

export default function createCttAPI() {
  return {
    /**
     * GET /api/ctt?rt=RT160147615PT
     * Scrapes CTT site and returns a structured summary:
     * { delivered:{status,date,time}, acceptedInCtt:{...}, accepted:{...}, in_transit:{...}, waitingToBeDelivered:{...} }
     */
    async getStatusAPI(req, res, next) {
      try {
        const rt = parseRt(req);
        const summary = await checkTrackingSummary(rt);

        res.status(200).json({
          ok: true,
          code: rt,
          message: "CTT shipment summary (scraped)",
          summary,
        });
      } catch (err) {
        next(err);
      }
    },

    // Future: GET /api/ctt/timeline?rt=... → could reuse Puppeteer or cheerio if needed
    // async getTimelineAPI(req, res, next) {
    //   try {
    //     const rt = parseRt(req);
    //     const events = await getPairedTimeline(rt);
    //     res.status(200).json({ ok: true, code: rt, events });
    //   } catch (err) {
    //     next(err);
    //   }
    // },
  };
}
