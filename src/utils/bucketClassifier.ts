/**
 * Ingredient bucketing pipeline
 * ─────────────────────────────
 *
 * Deterministic 4-stage algorithm — see bucketing_logic.md for the design doc.
 *
 *   Stage 1: hard RISK veto    → returns "Critical"
 *   Stage 2: hard BENEFIT veto → returns "Safe"
 *   Stage 3: numerical score
 *   Stage 4: bucket from score → "Critical" | "Moderate" | "Safe"
 *
 * The exported labels are kept as ("Critical" | "Moderate" | "Safe") to stay
 * compatible with the existing ResultsDashboard component that already
 * consumes those strings. Internally the buckets correspond 1-1 with the
 * design doc's RISK / MODERATE / BENEFIT.
 */

export type Bucket = "Critical" | "Moderate" | "Safe";

export interface UserProfile {
  conditions?: string[]; // e.g. ["coeliac", "pregnancy", "ckd", "diabetic", "g6pd"]
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Tunables — exposed so QA / product can move thresholds without code edits.  */
/* ─────────────────────────────────────────────────────────────────────────── */

export const TUNABLES = {
  // Stage 2 — pct_of_safe_limit cut-off below which a "benefit" ingredient
  // can be locked to Safe.
  BENEFIT_VETO_PCT_SAFE_MAX: 50,

  // Stage 4 — bucket cut-offs on the score axis.
  SCORE_BENEFIT_THRESHOLD: 20,
  SCORE_RISK_THRESHOLD: -25,
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && !Number.isNaN(v) ? v : fallback;

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

interface RiskEntry {
  label?: string;
  context?: string;
  severity_level?: string;
  exceeds_safe?: boolean;
  pct?: number;
}

interface IngredientRecord {
  tag?: string;
  description?: string;
  category?: string;
  severity?: string;
  dosage?: {
    unit?: string;
    typical_in_product?: number;
    rda?: number;
    safe_upper_limit?: number;
    tolerable_upper_limit?: number;
    toxicity_threshold?: number | null;
    pct_of_safe_limit?: number;
    authority?: string;
  };
  risks?: RiskEntry[];
  benefits?: unknown[];
}

function profileTriggersRisk(record: IngredientRecord, conditions: string[]): boolean {
  if (!conditions?.length) return false;
  const haystack = [
    record?.tag ?? "",
    record?.description ?? "",
    ...arr<RiskEntry>(record?.risks).map((r) => `${r?.label ?? ""} ${r?.context ?? ""}`),
  ]
    .join(" ")
    .toLowerCase();

  if (conditions.includes("coeliac") && /(coeliac|celiac|gluten)/.test(haystack)) return true;
  if (
    conditions.includes("pregnancy") &&
    /(teratogen|pregnancy|retinol|hypervitaminosis)/.test(haystack)
  )
    return true;
  if (conditions.includes("ckd") && /(ckd|kidney|hyperkala|renal)/.test(haystack)) return true;
  if (conditions.includes("g6pd") && /(g6pd|hemolytic|haemolytic)/.test(haystack)) return true;
  if (
    conditions.includes("diabetic") &&
    /(glycaemic|glycemic|insulin|added sugar|free sugar)/.test(haystack)
  )
    return true;
  return false;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Public API                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface BucketResult {
  bucket: Bucket;
  reason: string;
  score?: number;
}

/**
 * Decide which bucket an ingredient lands in.
 *
 * @param record           Raw Mongo document (from `ingredients_new`).
 * @param extractedAmount  Optional amount detected by OCR (in `dosage.unit`).
 *                         Falls back to `record.dosage.typical_in_product`.
 * @param user             Optional user profile (allergies, pregnancy, etc.).
 *                         Profile rules can ONLY promote to RISK; never demote.
 */
export function classifyIngredientDetailed(
  record: IngredientRecord | null | undefined,
  extractedAmount?: number,
  user: UserProfile = {},
): BucketResult {
  const dosage = record?.dosage ?? {};

  const actual =
    extractedAmount !== undefined && extractedAmount !== null
      ? extractedAmount
      : num(dosage.typical_in_product);

  const safe = num(dosage.safe_upper_limit, NaN);
  const tox = dosage.toxicity_threshold;
  const topSeverity: string = record?.severity ?? "ok";

  // Recompute pct_of_safe_limit when a custom OCR amount is supplied —
  // never trust a stale value baked into the record.
  const pctSafe =
    !Number.isNaN(safe) && safe > 0
      ? (actual / safe) * 100
      : num(dosage.pct_of_safe_limit);

  const risks = arr<RiskEntry>(record?.risks);
  const benefits = arr<unknown>(record?.benefits);

  /* ───── Stage 1: hard RISK veto ───── */

  if (
    typeof tox === "number" &&
    !Number.isNaN(tox) &&
    actual >= tox
  ) {
    return { bucket: "Critical", reason: "Hits toxicity threshold" };
  }

  if (risks.some((r) => r?.exceeds_safe === true)) {
    return { bucket: "Critical", reason: "exceeds_safe flag set on a risk entry" };
  }

  if (
    risks.some(
      (r) =>
        r?.severity_level === "high" && num(r?.pct) >= 100,
    )
  ) {
    return {
      bucket: "Critical",
      reason: "High-severity risk at or above its safe limit",
    };
  }

  if (pctSafe >= 100) {
    return { bucket: "Critical", reason: "Dose ≥ 100% of safe upper limit" };
  }

  if (topSeverity === "critical") {
    return { bucket: "Critical", reason: "Editorial severity = critical" };
  }

  if (user.conditions?.length && profileTriggersRisk(record ?? {}, user.conditions)) {
    return { bucket: "Critical", reason: "User-profile rule promotes to RISK" };
  }

  /* ───── Stage 2: hard BENEFIT veto ───── */

  const lowDose = pctSafe < TUNABLES.BENEFIT_VETO_PCT_SAFE_MAX;
  const noHighRisk = !risks.some((r) => r?.severity_level === "high");
  const noOverflow = !risks.some((r) => r?.exceeds_safe === true);
  const hasBenefit = benefits.length >= 1;

  if (
    topSeverity === "benefit" &&
    lowDose &&
    noHighRisk &&
    noOverflow &&
    hasBenefit
  ) {
    return {
      bucket: "Safe",
      reason: "Beneficial substance well within safe range",
    };
  }

  /* ───── Stage 3: numerical scoring ───── */

  let score = 0;

  // 5.1 — top-level severity
  switch (topSeverity) {
    case "critical":
      score -= 80;
      break;
    case "warn":
      score -= 30;
      break;
    case "ok":
      score += 5;
      break;
    case "benefit":
      score += 35;
      break;
  }

  // 5.2 — pct_of_safe_limit weight
  if (pctSafe >= 100) score -= 60;
  else if (pctSafe >= 70) score -= 35;
  else if (pctSafe >= 40) score -= 15;
  else if (pctSafe >= 15) score += 5;
  else score += 15;

  // 5.3 — risks aggregate (capped at -80)
  let riskDelta = 0;
  for (const r of risks) {
    if (r?.severity_level === "high") riskDelta -= 30;
    else if (r?.severity_level === "medium") riskDelta -= 12;
    else if (r?.severity_level === "low") riskDelta -= 3;
    if (r?.exceeds_safe === true) riskDelta -= 40;
  }
  score += Math.max(-80, riskDelta);

  // 5.4 — benefits aggregate (capped at +30)
  let benefitDelta = 0;
  if (benefits.length >= 1) {
    benefitDelta += 12 + 6 * Math.max(0, benefits.length - 1);
  }
  score += Math.min(30, benefitDelta);

  // 5.5 — category nudge
  const categoryNudge: Record<string, number> = {
    additive: -10,
    preservative: -10,
    vitamin: 10,
    mineral: 5,
    compound: 0,
    fat: 0,
  };
  score += categoryNudge[(record?.category ?? "compound").toLowerCase()] ?? 0;

  // 5.6 — authority confidence bonus
  const authority: string = (dosage?.authority ?? "").toString();
  if (/WHO|FDA|NIH|EFSA|JECFA/i.test(authority)) score += 3;

  // 5.7 — clamp
  score = Math.max(-100, Math.min(100, score));

  /* ───── Stage 4: bucket from score ───── */

  let bucket: Bucket;
  if (score >= TUNABLES.SCORE_BENEFIT_THRESHOLD) bucket = "Safe";
  else if (score < TUNABLES.SCORE_RISK_THRESHOLD) bucket = "Critical";
  else bucket = "Moderate";

  return { bucket, reason: `Score ${score}`, score };
}

/**
 * Backwards-compatible wrapper used by `ResultsDashboard.tsx`.
 * Returns just the bucket label so existing call-sites don't break.
 */
export function classifyIngredient(
  record: IngredientRecord | null | undefined,
  extractedAmount?: number,
  user?: UserProfile,
): Bucket {
  return classifyIngredientDetailed(record, extractedAmount, user).bucket;
}
