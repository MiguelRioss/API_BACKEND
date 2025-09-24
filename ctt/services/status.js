// services/cttStatus.mjs
import { checkTrackingByDateLeft } from "./checkTrackingByDateLeftVercel.js";

// Label → stage (cumulative flags)
const STAGES = [
  { re: /aguarda\s+entrada\s+nos\s+ctt/i, stage: 1, canonical: "Aguarda entrada nos CTT" },
  { re: /\baceite\b/i,                    stage: 2, canonical: "Aceite" },
  { re: /\bem\s*tr[aâ]ns[ií]to\b/i,       stage: 3, canonical: "Em trânsito" },
  { re: /\bem\s*transito\b/i,             stage: 3, canonical: "Em trânsito" }, // no accent
  { re: /em\s*espera/i,                   stage: 4, canonical: "Em espera" },
  { re: /entregue/i,                      stage: 5, canonical: "Entregue" },
];

function stageFromLabel(label = "") {
  for (const r of STAGES) if (r.re.test(label)) return { stage: r.stage, canonical: r.canonical };
  return { stage: 0, canonical: "unknown" };
}

/** Returns label + cumulative flags for a tracking id or full URL */
export async function getCttStatus(idOrUrl) {
  const label = await checkTrackingByDateLeft(String(idOrUrl).trim());
  const { stage, canonical } = stageFromLabel(label);

  const flags = {
    waiting_ctt: stage >= 1,  // Aguarda entrada nos CTT
    accepted:    stage >= 2,  // Aceite
    in_transit:  stage >= 3,  // Em trânsito
    waiting:     stage >= 4,  // Em espera
    delivered:   stage >= 5,  // Entregue
  };
  return { id: String(idOrUrl), label: canonical, flags };
}
