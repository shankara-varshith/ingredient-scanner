/**
 * ingredientParser — OCR text → structured ingredients
 * ─────────────────────────────────────────────────────
 * Replaces Gemini vision for the scanning step.  Takes the raw text string
 * returned by EasyOCR and produces the same shape that the existing
 * ResultsDashboard expects: { productType, ingredients[] }.
 *
 * Works in three stages:
 *   1. Normalise — fix common OCR artefacts, collapse whitespace, unify delimiters.
 *   2. Split    — separate individual ingredient tokens.
 *   3. Classify — determine product type from keyword frequency.
 */

/* ─────────────────────────────────────────────────────────────────────────── */
/* 1. Normalisation                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */

const OCR_FIXES: [RegExp, string][] = [
  // Common l/1/I confusion
  [/(?<=\w)l(?=\d)/g, "1"],              // e.g. "Bl2" → "B12"
  [/(?<=\d)l(?=\w)/g, "1"],
  // O/0 in numeric contexts
  [/(?<=\d)O/g, "0"],
  [/O(?=\d)/g, "0"],
  // Stray pipe characters → comma (OCR misreads vertical separators)
  [/\|/g, ","],
  // Curly/smart quotes → straight
  [/[""]/g, '"'],
  [/['']/g, "'"],
  // Multiple spaces/tabs → single space
  [/[ \t]+/g, " "],
];

function normalise(raw: string): string {
  let s = raw;
  for (const [pattern, replacement] of OCR_FIXES) {
    s = s.replace(pattern, replacement);
  }
  return s.trim();
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* 2. Splitting                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Ingredients lists are usually comma-separated, but OCR can introduce
 * line-breaks mid-ingredient. Strategy:
 *   • If the text has commas, split on commas.
 *   • Otherwise split on newlines.
 *   • Strip percentage annotations, E-number parentheticals we don't need.
 */

// Matches the "Ingredients:" / "INGREDIENTS" header (with optional colon)
const INGREDIENTS_HEADER = /\b(?:ingredients|composition|contains|ingrédients)\s*[:\-–—]?\s*/i;

// Junk lines that are clearly not ingredients
const JUNK_LINE = /^(nutrition\s+facts|serving\s+size|calories|daily\s+value|amount\s+per|net\s+wt|best\s+before|manufactured|distributed|storage|allergen|warning|may\s+contain)/i;

function splitIngredients(text: string): string[] {
  // Try to isolate the ingredients section
  let body = text;
  const headerMatch = text.match(INGREDIENTS_HEADER);
  if (headerMatch) {
    body = text.slice(headerMatch.index! + headerMatch[0].length);
  }

  // Stop at common section boundaries after the ingredients list
  const stopPatterns = [
    /\b(?:nutrition\s+facts|nutritional\s+information|allergen|warnings?|storage|net\s+wt|manufactured|distributed|best\s+before)\b/i,
  ];
  for (const stop of stopPatterns) {
    const m = body.match(stop);
    if (m && m.index !== undefined) {
      body = body.slice(0, m.index);
    }
  }

  // Decide delimiter
  const commaCount = (body.match(/,/g) || []).length;
  const items =
    commaCount >= 2
      ? body.split(",")
      : body.split(/\n+/);

  return items
    .map((s) => s.trim())
    .map((s) => s.replace(/^\d+[\.\)]\s*/, ""))         // "1. Sugar" → "Sugar"
    .map((s) => s.replace(/\s*\d+(\.\d+)?%?\s*$/, ""))  // trailing "%"
    .map((s) => s.replace(/\.$/, "").trim())             // trailing period
    .filter((s) => s.length >= 2 && s.length <= 120)     // too short = noise, too long = sentence
    .filter((s) => !JUNK_LINE.test(s));
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* 3. Product-type classification                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

type ProductType = "Food" | "Beauty/Cosmetics" | "Supplement" | "Other";

const FOOD_KEYWORDS = new Set([
  "sugar", "salt", "water", "flour", "oil", "butter", "milk", "cream",
  "starch", "vinegar", "yeast", "spice", "garlic", "onion", "pepper",
  "corn", "wheat", "soy", "rice", "cocoa", "chocolate", "vanilla",
  "dextrose", "maltodextrin", "lecithin", "gelatin", "pectin",
  "citric acid", "lactic acid", "acetic acid", "sodium chloride",
  "high fructose", "palm", "canola", "sunflower", "olive",
]);

const COSMETIC_KEYWORDS = new Set([
  "aqua", "dimethicone", "cetyl", "stearyl", "glycerin", "parfum",
  "fragrance", "tocopherol", "retinol", "hyaluronic", "niacinamide",
  "sodium laureth", "sodium lauryl", "carbomer", "phenoxyethanol",
  "methylparaben", "propylparaben", "ci ", "titanium dioxide",
  "iron oxide", "mica", "silica", "talc", "petrolatum", "lanolin",
  "isopropyl", "cetearyl", "acrylates", "peg-", "ppg-",
]);

const SUPPLEMENT_KEYWORDS = new Set([
  "vitamin a", "vitamin b", "vitamin c", "vitamin d", "vitamin e",
  "vitamin k", "biotin", "folate", "folic acid", "riboflavin",
  "thiamine", "niacin", "pantothenic", "cobalamin", "pyridoxine",
  "serving size", "daily value", "supplement facts", "capsule",
  "tablet", "softgel", "probiotic", "prebiotic", "fish oil",
  "omega-3", "zinc", "magnesium", "calcium", "iron", "selenium",
  "chromium", "manganese", "potassium", "ashwagandha", "turmeric",
  "coenzyme", "glucosamine", "melatonin", "collagen",
]);

function classifyProductType(rawText: string, ingredients: string[]): ProductType {
  const lower = rawText.toLowerCase() + " " + ingredients.join(" ").toLowerCase();

  let foodScore = 0;
  let cosmeticScore = 0;
  let supplementScore = 0;

  for (const kw of FOOD_KEYWORDS) {
    if (lower.includes(kw)) foodScore++;
  }
  for (const kw of COSMETIC_KEYWORDS) {
    if (lower.includes(kw)) cosmeticScore++;
  }
  for (const kw of SUPPLEMENT_KEYWORDS) {
    if (lower.includes(kw)) supplementScore++;
  }

  const max = Math.max(foodScore, cosmeticScore, supplementScore);
  if (max === 0) return "Other";
  if (cosmeticScore === max) return "Beauty/Cosmetics";
  if (supplementScore === max) return "Supplement";
  return "Food";
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Public API                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface ParsedIngredients {
  productType: ProductType;
  ingredients: string[];
}

export function parseOcrText(rawText: string): ParsedIngredients {
  const normalised = normalise(rawText);
  const ingredients = splitIngredients(normalised);
  const productType = classifyProductType(normalised, ingredients);

  return { productType, ingredients };
}
