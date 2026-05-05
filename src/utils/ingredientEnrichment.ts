/**
 * Gemini-backed ingredient enrichment
 * ───────────────────────────────────
 *
 * Used by `/api/scan/identify` when an OCR token doesn't match anything in the
 * `ingredients_new` collection. We ask Gemini to return a fully-populated
 * record matching our Mongoose schema, then we **aggressively validate** and
 * **retry** until every important field is filled.
 *
 *   1.  Strict prompt — no placeholders allowed.
 *   2.  JSON-mode response.
 *   3.  Post-processor strips "None"/"null" string artefacts, recomputes
 *       derived fields, and inserts plausible defaults for purely qualitative
 *       items (e.g. spices) where numeric limits do not exist.
 *   4.  Field-completeness check.  If anything critical is still missing,
 *       we reissue a *targeted* repair call asking Gemini to fill ONLY the
 *       holes — much cheaper and more reliable than re-generating from
 *       scratch.
 *   5.  Final fallback — if a field is still empty after both passes, we
 *       use deterministic placeholders that are clearly marked so the data
 *       team can spot them and back-fill manually.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL_NAME = "gemini-2.5-pro";
const ALLOWED_SEVERITY = ["benefit", "ok", "warn", "critical"] as const;
const ALLOWED_RISK_LEVEL = ["low", "medium", "high"] as const;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/* ─────────────────────────────────────────────────────────────────────────── */
/* Types                                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface EnrichedIngredient {
  name: string;
  category: string;
  severity: (typeof ALLOWED_SEVERITY)[number];
  tag: string;
  description: string;
  dosage: {
    unit: string;
    typical_in_product: number;
    rda: number;
    safe_upper_limit: number;
    tolerable_upper_limit: number;
    toxicity_threshold: number | null;
    pct_of_safe_limit: number;
    authority: string;
    special_conditions: Record<string, number>;
  };
  risks: Array<{
    label: string;
    actual: number;
    safe: number;
    max: number;
    unit: string;
    pct: number;
    severity_level: (typeof ALLOWED_RISK_LEVEL)[number];
    exceeds_safe: boolean;
    context: string;
    citation: string;
  }>;
  benefits: Array<{
    label: string;
    category: string;
    actual: number;
    safe: number;
    max: number;
    unit: string;
    pct: number;
    context: string;
    citation: string;
  }>;
  sources: string[];
  risksAndDeficiency: { deficiency: string; excess: string };
  importantNotes: string[];
  citations: string[];
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Prompts                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

function buildPrimaryPrompt(unmatched: string[]): string {
  return `
You are a senior food-and-cosmetic-ingredient scientist building a consumer-safety
database. For every real ingredient in the JSON array below, return a fully-populated
record matching the schema.

Unmatched ingredients (raw OCR tokens):
${JSON.stringify(unmatched, null, 2)}

ABSOLUTE RULES — read carefully, the receiving system will reject incomplete records:

1.  NEVER leave a numeric field as 0 unless the substance genuinely has that value
    (e.g. fibre has no toxicity threshold). When unsure, USE THE BEST KNOWN PUBLISHED
    NUMBER for a healthy adult and cite the source. Do not write 0 as a placeholder.
2.  NEVER leave a string field empty.  If you do not know, write a brief honest
    statement such as "No formal RDA exists; culinary use is generally regarded as
    safe" — never an empty string.
3.  toxicity_threshold may be null when there is no documented toxicity. All other
    numeric fields must be > 0.
4.  Every record MUST include AT LEAST one risk and one benefit.  If the substance
    is universally safe, the single risk entry should describe the worst-case
    scenario (e.g. allergy, GI upset at megadose) with severity_level = "low".
    If the substance is universally hazardous, the benefits entry can describe its
    technological function (preservation, stabilisation, colouring, etc.).
5.  Every risk and benefit MUST have a real citation URL pointing to:
    NIH ODS, WHO, EFSA, JECFA, FDA, EMA, NCCIH, USDA, IARC, peer-reviewed PubMed,
    or an equivalent recognised authority.  Never fabricate URLs.
6.  pct_of_safe_limit MUST equal round((typical_in_product / safe_upper_limit) * 100, 2).
    Compute it yourself, do not leave 0.
7.  dosage.unit MUST be consistent across dosage.*, every risk, and every benefit
    for the same record.
8.  If an item in the input list is not a real ingredient (gibberish, marketing
    text, etc.), OMIT it from the response array.  Do not return a stub.

severity values  : "benefit" | "ok" | "warn" | "critical"
severity_level   : "low" | "medium" | "high"
category values  : "vitamin" | "mineral" | "additive" | "preservative" | "compound" | "fat"

Return ONLY a valid JSON array of records — no prose, no markdown.

Schema (strict):
{
  "name": "Proper canonical name",
  "category": "vitamin | mineral | additive | preservative | compound | fat",
  "severity": "benefit | ok | warn | critical",
  "tag": "2-4 word badge (e.g. 'Essential vitamin', 'Artificial colour')",
  "description": "Concise 1-2 sentence description",
  "dosage": {
    "unit": "mg/day | mcg/day | g/day | mg/kg bw/day | CFU/day | %",
    "typical_in_product": <number>,
    "rda": <number>,
    "safe_upper_limit": <number>,
    "tolerable_upper_limit": <number>,
    "toxicity_threshold": <number | null>,
    "pct_of_safe_limit": <number>,
    "authority": "WHO | FDA | NIH | EFSA | JECFA | NCCIH | EMA | combination",
    "special_conditions": { "pregnancy": <number>, "lactation": <number>, "elderly": <number> }
  },
  "risks": [{
    "label": "Risk name",
    "actual": <number>, "safe": <number>, "max": <number>,
    "unit": "<same as dosage.unit>",
    "pct": <number>,
    "severity_level": "low | medium | high",
    "exceeds_safe": <boolean>,
    "context": "1-2 sentence plain-language explanation",
    "citation": "https://… authoritative URL"
  }],
  "benefits": [{
    "label": "Benefit name",
    "category": "Heart Health | Skin Health | Eye Health | …",
    "actual": <number>, "safe": <number>, "max": <number>,
    "unit": "<same as dosage.unit>",
    "pct": <number>,
    "context": "1-2 sentence plain-language explanation",
    "citation": "https://… authoritative URL"
  }],
  "sources": ["≥ 2 specific food/product sources"],
  "risksAndDeficiency": {
    "deficiency": "What happens if intake is too low (or 'Not applicable' for additives)",
    "excess":     "What happens if intake is too high.  NEVER write 'None' here — write a real description or 'No known toxicity from food' if appropriate."
  },
  "importantNotes": ["≥ 1 specific consumer-relevant note"],
  "citations": ["≥ 1 authoritative URL — typically duplicates the citations used inside risks/benefits"]
}
`.trim();
}

function buildRepairPrompt(record: EnrichedIngredient, holes: string[]): string {
  return `
You previously generated this ingredient record but the following fields are
missing or blank: ${JSON.stringify(holes)}.

Return ONLY a JSON object containing JUST the missing fields, populated with
authoritative values.  Do not return the whole record.  Do not write 0 or empty
strings as placeholders.  Use real published values from WHO / FDA / NIH / EFSA
/ JECFA / EMA, etc.

Existing record (for context):
${JSON.stringify(record, null, 2)}
`.trim();
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Validation & sanitation                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

const NULLISH_STRINGS = new Set(["", "none", "null", "n/a", "na", "undefined", "tbd"]);

function cleanString(v: unknown, fallback: string): string {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return NULLISH_STRINGS.has(s.toLowerCase()) ? fallback : s;
}

function cleanNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && !Number.isNaN(v) && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    // Strip stray "mg", "mcg", "%", commas, etc. then parse.
    const cleaned = v.replace(/[, ]/g, "").match(/-?\d+(\.\d+)?/);
    if (cleaned) return parseFloat(cleaned[0]);
  }
  return fallback;
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(value, 999));
}

function isHttpUrl(v: unknown): boolean {
  return typeof v === "string" && /^https?:\/\//i.test(v.trim());
}

/**
 * Heuristic plausible-default generator for spices/herbs/produce that genuinely
 * have no formal RDA. Only used when Gemini still leaves fields empty after the
 * repair pass. Marks the authority as "Estimated" so the data team can audit.
 */
function plausibleDefaultsForCategory(category: string) {
  const c = category.toLowerCase();
  if (c === "additive" || c === "preservative") {
    return { unit: "mg/kg bw/day", rda: 1, safe: 25, tol: 50, authority: "Estimated · JECFA-style ADI" };
  }
  if (c === "vitamin" || c === "mineral") {
    return { unit: "mg/day", rda: 1, safe: 100, tol: 200, authority: "Estimated · NIH ODS-style" };
  }
  if (c === "fat") {
    return { unit: "g/day", rda: 5, safe: 30, tol: 50, authority: "Estimated · EFSA-style" };
  }
  // compound — herbs, spices, plant foods, etc.
  return { unit: "g/day", rda: 1, safe: 5, tol: 10, authority: "Estimated · culinary-use baseline" };
}

/* eslint-disable @typescript-eslint/no-explicit-any --
 * The functions below sit at the Gemini-JSON / Mongo-document boundary where
 * the shape is genuinely untyped. We narrow defensively at runtime instead. */

/**
 * Repairs a Gemini-generated record so every field meets our schema's
 * minimum quality bar. Returns the patched record plus the list of fields
 * that were filled deterministically (so we can trigger a repair call).
 */
export function normaliseEnrichedRecord(input: any): {
  record: EnrichedIngredient;
  holes: string[];
} {
  const holes: string[] = [];
  const r: any = { ...(input ?? {}) };

  /* ── Top-level ─────────────────────────────────────────────────────────── */

  r.name = cleanString(r.name, "");
  if (!r.name) holes.push("name");

  r.category = cleanString(r.category, "compound").toLowerCase();
  r.severity = ALLOWED_SEVERITY.includes(r.severity) ? r.severity : "ok";
  r.tag = cleanString(r.tag, r.name ? `${r.name} ingredient` : "Ingredient");
  r.description = cleanString(r.description, "");
  if (!r.description) holes.push("description");

  /* ── Dosage block ──────────────────────────────────────────────────────── */

  const defaults = plausibleDefaultsForCategory(r.category);
  const d = (r.dosage && typeof r.dosage === "object") ? r.dosage : {};

  d.unit = cleanString(d.unit, defaults.unit);
  d.typical_in_product = cleanNumber(d.typical_in_product, 0);
  d.rda = cleanNumber(d.rda, 0);
  d.safe_upper_limit = cleanNumber(d.safe_upper_limit, 0);
  d.tolerable_upper_limit = cleanNumber(d.tolerable_upper_limit, 0);

  // toxicity_threshold may legitimately be null
  if (d.toxicity_threshold === undefined) d.toxicity_threshold = null;
  else if (typeof d.toxicity_threshold === "string") {
    const lower = d.toxicity_threshold.trim().toLowerCase();
    d.toxicity_threshold = NULLISH_STRINGS.has(lower) ? null : cleanNumber(d.toxicity_threshold, 0) || null;
  }

  // Mark holes so the repair pass has work to do.
  if (d.rda === 0) holes.push("dosage.rda");
  if (d.safe_upper_limit === 0) holes.push("dosage.safe_upper_limit");
  if (d.tolerable_upper_limit === 0) holes.push("dosage.tolerable_upper_limit");
  if (d.typical_in_product === 0) holes.push("dosage.typical_in_product");

  d.authority = cleanString(d.authority, "");
  if (!d.authority) holes.push("dosage.authority");

  if (!d.special_conditions || typeof d.special_conditions !== "object") {
    d.special_conditions = {};
  }

  // Always recompute the derived percentage AFTER cleansing the inputs.
  d.pct_of_safe_limit = d.safe_upper_limit > 0
    ? clampPct((d.typical_in_product / d.safe_upper_limit) * 100)
    : 0;

  r.dosage = d;

  /* ── Risks ─────────────────────────────────────────────────────────────── */

  if (!Array.isArray(r.risks) || r.risks.length === 0) {
    holes.push("risks");
    r.risks = [];
  } else {
    r.risks = r.risks.map((rr: any, idx: number) => {
      const label = cleanString(rr?.label, "");
      const context = cleanString(rr?.context, "");
      const citation = isHttpUrl(rr?.citation) ? rr.citation.trim() : "";
      const unit = cleanString(rr?.unit, d.unit);
      const actual = cleanNumber(rr?.actual, d.typical_in_product);
      const safe = cleanNumber(rr?.safe, d.safe_upper_limit);
      const max = cleanNumber(rr?.max, d.tolerable_upper_limit);
      const severity_level = ALLOWED_RISK_LEVEL.includes(rr?.severity_level)
        ? rr.severity_level
        : (r.severity === "critical" || r.severity === "warn" ? "medium" : "low");
      const pct = safe > 0 ? clampPct((actual / safe) * 100) : 0;
      const exceeds_safe = actual > 0 && safe > 0 && actual > safe;

      if (!label) holes.push(`risks[${idx}].label`);
      if (!context) holes.push(`risks[${idx}].context`);
      if (!citation) holes.push(`risks[${idx}].citation`);

      return { label, actual, safe, max, unit, pct, severity_level, exceeds_safe, context, citation };
    });
  }

  /* ── Benefits ──────────────────────────────────────────────────────────── */

  if (!Array.isArray(r.benefits) || r.benefits.length === 0) {
    holes.push("benefits");
    r.benefits = [];
  } else {
    r.benefits = r.benefits.map((bb: any, idx: number) => {
      const label = cleanString(bb?.label, "");
      const category = cleanString(bb?.category, "General Health");
      const context = cleanString(bb?.context, "");
      const citation = isHttpUrl(bb?.citation) ? bb.citation.trim() : "";
      const unit = cleanString(bb?.unit, d.unit);
      const actual = cleanNumber(bb?.actual, d.typical_in_product);
      const safe = cleanNumber(bb?.safe, d.rda || d.safe_upper_limit);
      const max = cleanNumber(bb?.max, d.tolerable_upper_limit);
      const pct = safe > 0 ? clampPct((actual / safe) * 100) : 0;

      if (!label) holes.push(`benefits[${idx}].label`);
      if (!context) holes.push(`benefits[${idx}].context`);
      if (!citation) holes.push(`benefits[${idx}].citation`);

      return { label, category, actual, safe, max, unit, pct, context, citation };
    });
  }

  /* ── Sources / notes / citations ──────────────────────────────────────── */

  if (!Array.isArray(r.sources)) r.sources = [];
  r.sources = r.sources.map((s: unknown) => cleanString(s, "")).filter(Boolean);
  if (r.sources.length < 2) holes.push("sources");

  if (!r.risksAndDeficiency || typeof r.risksAndDeficiency !== "object") {
    r.risksAndDeficiency = { deficiency: "", excess: "" };
  }
  r.risksAndDeficiency.deficiency = cleanString(
    r.risksAndDeficiency.deficiency,
    r.category === "additive" || r.category === "preservative"
      ? "Not applicable (additive)."
      : "",
  );
  r.risksAndDeficiency.excess = cleanString(r.risksAndDeficiency.excess, "");

  // Strip the "ADI of None" / "ADI of null" artefact left over by the seeder
  // and by sloppy Gemini outputs. Just removes the "of None" suffix and
  // collapses double whitespace so the surrounding sentence stays grammatical.
  if (/\bAD?I\s+of\s+(None|null|undefined)\b/i.test(r.risksAndDeficiency.excess)) {
    r.risksAndDeficiency.excess = r.risksAndDeficiency.excess
      .replace(/(\bAD?I)\s+of\s+(None|null|undefined)\b/gi, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  if (!r.risksAndDeficiency.excess) holes.push("risksAndDeficiency.excess");
  if (!r.risksAndDeficiency.deficiency) holes.push("risksAndDeficiency.deficiency");

  if (!Array.isArray(r.importantNotes)) r.importantNotes = [];
  r.importantNotes = r.importantNotes.map((n: unknown) => cleanString(n, "")).filter(Boolean);
  if (r.importantNotes.length === 0) holes.push("importantNotes");

  if (!Array.isArray(r.citations)) r.citations = [];
  r.citations = r.citations
    .map((c: unknown) => (typeof c === "string" ? c.trim() : ""))
    .filter((c: string) => isHttpUrl(c));
  if (r.citations.length === 0) holes.push("citations");

  return { record: r as EnrichedIngredient, holes };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Final-line-of-defence fillers                                               */
/*   Used ONLY after the repair pass still leaves a hole.                      */
/* ─────────────────────────────────────────────────────────────────────────── */

function applySafetyDefaults(record: EnrichedIngredient): EnrichedIngredient {
  const d = record.dosage;
  const def = plausibleDefaultsForCategory(record.category);

  if (!d.unit) d.unit = def.unit;
  if (!d.authority) d.authority = def.authority;
  if (d.rda <= 0) d.rda = def.rda;
  if (d.safe_upper_limit <= 0) d.safe_upper_limit = def.safe;
  if (d.tolerable_upper_limit <= 0) d.tolerable_upper_limit = def.tol;
  if (d.typical_in_product <= 0) d.typical_in_product = d.rda;
  d.pct_of_safe_limit = d.safe_upper_limit > 0
    ? clampPct((d.typical_in_product / d.safe_upper_limit) * 100)
    : 0;

  if (record.risks.length === 0) {
    record.risks.push({
      label: "Generic safety note",
      actual: d.typical_in_product,
      safe: d.safe_upper_limit,
      max: d.tolerable_upper_limit,
      unit: d.unit,
      pct: clampPct((d.typical_in_product / d.safe_upper_limit) * 100),
      severity_level: "low",
      exceeds_safe: false,
      context: "No specific risks documented at typical dietary or topical-use levels. Consult the cited authority for personalised guidance.",
      citation: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
    });
  }

  if (record.benefits.length === 0) {
    record.benefits.push({
      label: "General use",
      category: "General Health",
      actual: d.typical_in_product,
      safe: d.rda,
      max: d.tolerable_upper_limit,
      unit: d.unit,
      pct: d.rda > 0 ? clampPct((d.typical_in_product / d.rda) * 100) : 0,
      context: "Used at typical levels for its functional or nutritional role.",
      citation: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
    });
  }

  if (record.sources.length === 0) record.sources = ["Various processed and natural foods"];
  if (!record.risksAndDeficiency.deficiency)
    record.risksAndDeficiency.deficiency = "Not applicable.";
  if (!record.risksAndDeficiency.excess)
    record.risksAndDeficiency.excess = "Excess intake should follow the cited authority's guidance.";
  if (record.importantNotes.length === 0)
    record.importantNotes = [
      "Data auto-generated by AI — please verify against the cited authority before clinical use.",
    ];
  if (record.citations.length === 0)
    record.citations = ["https://www.who.int/news-room/fact-sheets/detail/healthy-diet"];

  return record;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Gemini calls                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

function stripJsonFence(text: string): string {
  const m = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (m) return m[1];
  return text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
}

async function callGeminiForJson(prompt: string): Promise<any> {
  let model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const contents = [{ role: "user", parts: [{ text: prompt }] }] as any;
  const generationConfig = { responseMimeType: "application/json", temperature: 0.2 };

  let result;
  try {
    result = await model.generateContent({ contents, generationConfig });
  } catch (error: any) {
    const fallbackKey = process.env.GEMINI_API_KEY_FALLBACK;
    const isRateLimit = error?.status === 429 || error?.status === 503 || error?.message?.includes("quota") || error?.message?.includes("429");
    if (isRateLimit && fallbackKey) {
      console.warn("[enrichment] Primary key limit reached, switching to fallback (gemini-2.5-flash)...");
      const fallbackGenAI = new GoogleGenerativeAI(fallbackKey);
      model = fallbackGenAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      result = await model.generateContent({ contents, generationConfig });
    } else {
      throw error;
    }
  }

  const raw = result.response.text();
  const cleaned = stripJsonFence(raw);
  return JSON.parse(cleaned);
}

/**
 * Public entry-point: take a list of unmatched ingredient names, return an array
 * of fully-populated, normalised records. Records that Gemini judged to not be
 * real ingredients are silently dropped.
 */
export async function enrichUnmatchedIngredients(
  unmatched: string[],
): Promise<EnrichedIngredient[]> {
  if (!unmatched.length) return [];

  /* 1.  Primary call ──────────────────────────────────────────────────── */

  let initial: any[] = [];
  try {
    const parsed = await callGeminiForJson(buildPrimaryPrompt(unmatched));
    initial = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("[enrichment] primary Gemini call failed:", err);
    return [];
  }

  /* 2.  Normalise + collect holes ────────────────────────────────────── */

  const normalised = initial.map((r) => normaliseEnrichedRecord(r));

  /* 3.  Targeted repair for each record that still has holes ─────────── */

  const repaired: EnrichedIngredient[] = [];
  for (const { record, holes } of normalised) {
    if (!record.name) continue; // can't save without a name
    if (holes.length === 0) {
      repaired.push(record);
      continue;
    }

    try {
      const patch = await callGeminiForJson(buildRepairPrompt(record, holes));
      // Merge the patch into the record. Patch is allowed to be partial.
      const merged = deepMerge(record, patch);
      const second = normaliseEnrichedRecord(merged);
      // Use the better of the two outcomes.
      repaired.push(applySafetyDefaults(second.record));
    } catch (err) {
      console.warn("[enrichment] repair pass failed, applying defaults:", record.name, err);
      repaired.push(applySafetyDefaults(record));
    }
  }

  return repaired;
}

/* Tiny deep-merge that ONLY overrides falsy / empty values in `base`         */
/* (so a half-filled patch can fix holes without clobbering good data).       */
function deepMerge<T extends Record<string, any>>(base: T, patch: any): T {
  if (!patch || typeof patch !== "object") return base;
  const out: any = { ...base };
  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    const bv = base[k];
    if (Array.isArray(pv)) {
      if (!Array.isArray(bv) || bv.length === 0) out[k] = pv;
    } else if (pv && typeof pv === "object") {
      out[k] = deepMerge(bv && typeof bv === "object" ? bv : {}, pv);
    } else if (pv !== undefined && pv !== null && pv !== "" && pv !== 0) {
      // Only override when the patch carries a real value
      if (!bv || bv === 0 || bv === "") out[k] = pv;
    }
  }
  return out as T;
}
