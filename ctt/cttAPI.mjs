  // ctt/cttAPI.mjs
  import { getShipmentSummaryByCode } from "./shipment_summary.mjs";

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
      /** GET /api/ctt?rt=RT160147615PT — sends summary JSON */
      async getStatusAPI(req, res, next) {
        try {
          const rt = parseRt(req);
          const summary = await getShipmentSummaryByCode(rt);

          res
            .status(200)
            .json({
              ok: true,
              code: rt,
              message: "CTT shipment summary",
              summary, // { delivered:{status,date,time}, ... }
            });
        } catch (err) {
          next(err);
        }
      },

      /** GET /api/ctt/timeline?rt=RT160147615PT — sends paired events JSON */
      // async getTimelineAPI(req, res, next) {
      //   try {
      //     const rt = parseRt(req);

      //     // Build full URL for getPairedTimeline (if your impl needs it)
      //     const params = new URLSearchParams({
      //       ObjectCodeInput: rt,
      //       SearchInput: rt,
      //       IsFromPublicArea: "true",
      //     });
      //     const url = `https://appserver.ctt.pt/CustomerArea/PublicArea_Detail?${params.toString()}`;

      //     const events = await getPairedTimeline(url); // [{date,time,message}, …]

      //     res
      //       .status(200)
      //       .json({
      //         ok: true,
      //         code: rt,
      //         message: "CTT paired timeline events",
      //         events,
      //       });
      //   } catch (err) {
      //     next(err);
      //   }
      // },
    };
  }
