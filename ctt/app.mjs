// app.mjs
import { getShipmentSummaryByCode } from "./shipment_summary.mjs";

const rtCode = "RT160147615PT"; // just the code
const summary = await getShipmentSummaryByCode(rtCode);

console.log(summary);
