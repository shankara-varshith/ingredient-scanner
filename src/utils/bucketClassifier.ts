export const QUALITATIVE_RISK_KEYWORDS = [
  "allergen", "carcinogen", "toxic", "hazard",
  "anaphylaxis", "iarc group", "celiac", "pku",
  "neurotoxic", "teratogen", "top-9 allergen",
  "kernicterus",
];

export const TUNABLES = {
  HIGH_RISK_PCT_SAFE: 80,
  MODERATE_PCT_SAFE_LOW: 50,
  MODERATE_PCT_SAFE_MED: 30,
  ESSENTIAL_RDA_FLOOR: 0.3,
  ESSENTIAL_RDA_CEIL: 1.5,
  SCORE_RISK_THRESHOLD: 25,
  SCORE_BENEFIT_THRESHOLD: -10,
};

export function classifyIngredient(record: any, extractedAmount?: number): "Critical" | "Moderate" | "Safe" {
  // Pre-computed runtime values
  const actual = extractedAmount !== undefined && extractedAmount !== null 
    ? extractedAmount 
    : (record.dosage?.typical_in_product || 0);

  const safe = record.dosage?.safe_upper_limit;
  const tol = record.dosage?.tolerable_upper_limit;
  const tox = record.dosage?.toxicity_threshold;
  const rda = record.dosage?.rda;

  const pct_safe = safe ? (actual / safe) * 100 : 0;
  const pct_rda = rda ? (actual / rda) * 100 : 0;

  const top_sev = record.severity || "ok"; // critical | warn | ok | benefit
  
  const riskLevels = (record.risks || []).map((r: any) => r.severity_level);
  let risk_max = "none";
  if (riskLevels.includes("high")) risk_max = "high";
  else if (riskLevels.includes("medium")) risk_max = "medium";
  else if (riskLevels.includes("low")) risk_max = "low";

  const ben_count = (record.benefits || []).length;
  const category = (record.category || "").toLowerCase();

  // --- Layer 1: Qualitative RISK overrides (dose-independent) ---
  const hasQualitativeRisk = () => {
    const textToSearch = [
      record.tag || "",
      ...(record.risks || []).map((r: any) => `${r.label} ${r.context}`)
    ].join(" ").toLowerCase();

    return QUALITATIVE_RISK_KEYWORDS.some(keyword => textToSearch.includes(keyword.toLowerCase()));
  };

  if (hasQualitativeRisk()) {
    // Note: User profile check would go here to potentially skip this rule
    return "Critical";
  }

  // --- Layer 2: Quantitative RISK gates ---
  if (tox !== null && tox !== undefined && actual >= tox) return "Critical";
  if (safe !== null && safe !== undefined && actual >= safe) return "Critical";
  if (top_sev === "critical") return "Critical";
  if (risk_max === "high" && pct_safe >= TUNABLES.HIGH_RISK_PCT_SAFE) return "Critical";

  // --- Layer 3: Qualitative BENEFIT rules ---
  const isBenefitQualitative = 
    top_sev === "benefit" &&
    ["low", "none"].includes(risk_max) &&
    pct_safe < 50 &&
    ben_count >= 1;

  const isEssentialNutrientSweetSpot = 
    ["vitamin", "mineral"].includes(category) &&
    rda &&
    (TUNABLES.ESSENTIAL_RDA_FLOOR * rda) <= actual && actual <= (TUNABLES.ESSENTIAL_RDA_CEIL * rda) &&
    pct_safe < 50;

  if (isBenefitQualitative || isEssentialNutrientSweetSpot) {
    return "Safe";
  }

  // --- Layer 4: Quantitative MODERATE gates ---
  if (pct_safe >= TUNABLES.MODERATE_PCT_SAFE_LOW && pct_safe < 100) return "Moderate";
  if (risk_max === "medium" && pct_safe >= TUNABLES.MODERATE_PCT_SAFE_MED) return "Moderate";
  if (top_sev === "warn") return "Moderate"; // Because it didn't trigger Layer 2
  if (category === "additive") return "Moderate";

  // --- Layer 5: Score-based tiebreaker ---
  let S = 0;

  if (risk_max === "high") S += 60;
  else if (risk_max === "medium") S += 30;
  else if (risk_max === "low") S += 10;

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
  S *= clamp(pct_safe / 100, 0.1, 2.0);

  S -= 20 * Math.min(ben_count, 3);

  if (rda && (0.5 * rda) <= actual && actual <= (1.5 * rda) && ["vitamin", "mineral"].includes(category)) {
    S -= 20;
  }

  const topSevScores: Record<string, number> = { "critical": 40, "warn": 20, "ok": 0, "benefit": -30 };
  S += topSevScores[top_sev] || 0;

  const categoryScores: Record<string, number> = {
    "additive": 20, "preservative": 15,
    "vitamin": -10, "mineral": -10,
    "compound": -10, "fat": 0
  };
  S += categoryScores[category] || 0;

  if (S >= TUNABLES.SCORE_RISK_THRESHOLD) return "Critical";
  if (S >= TUNABLES.SCORE_BENEFIT_THRESHOLD) return "Moderate";
  return "Safe";
}
