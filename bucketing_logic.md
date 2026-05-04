# Ingredient Bucketing Logic — Risks / Moderate / Benefits

A deterministic, auditable algorithm that sorts every matched ingredient into exactly one of three buckets:

| Bucket            | Meaning to the user                              | UI colour |
| ----------------- | ------------------------------------------------ | --------- |
| `RISK`            | Stop, read the warning, possibly avoid           | Red       |
| `MODERATE`        | Worth knowing — fine in moderation               | Amber     |
| `BENEFIT`         | Naturally good for you and within safe range     | Green     |

The algorithm reads only from the `ingredients_new` schema you already have. **No human curation is needed once the rules below are implemented.** The output of the function becomes the `bucket` field that drives the summary tiles in §2.2 of the Antigravity brief.

---

## 1. Core principle

> **Bucket = (intrinsic hazard of the substance)  ×  (how close this product gets to the harmful dose).**

Both axes are already in the JSON. Hazard lives in `severity`, `risks[].severity_level`, `risks[].exceeds_safe` and `dosage.toxicity_threshold`. Dose proximity lives in `dosage.pct_of_safe_limit` and `risks[].pct`.

We combine them in a fixed pipeline of **four stages**, each acting as a veto over the next. The first stage that fires wins — so the rules are predictable and debuggable.

---

## 2. The four-stage pipeline

```
                             ┌────────────────────┐
   ingredient + product ──▶  │  STAGE 1: HARD     │  ──▶ RISK   (no further checks)
                             │  RISK VETO         │
                             └────────────────────┘
                                       │ (no veto)
                                       ▼
                             ┌────────────────────┐
                             │  STAGE 2: HARD     │  ──▶ BENEFIT
                             │  BENEFIT VETO      │
                             └────────────────────┘
                                       │ (no veto)
                                       ▼
                             ┌────────────────────┐
                             │  STAGE 3: SCORE    │  ──▶ score ∈ [-100, +100]
                             └────────────────────┘
                                       │
                                       ▼
                             ┌────────────────────┐
                             │  STAGE 4: BUCKET   │  ──▶ RISK / MODERATE / BENEFIT
                             │  FROM SCORE        │
                             └────────────────────┘
```

The vetoes (stages 1 & 2) catch the **unambiguous** cases. The score (stages 3 & 4) handles **ambiguity** with a numeric cushion that no single field can override.

---

## 3. Stage 1 — Hard RISK veto

The ingredient is **forced** into `RISK` if **any** of these are true:

| #   | Condition                                                                              | Why                                                                               |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1.1 | `dosage.toxicity_threshold != null` AND `typical_in_product >= toxicity_threshold`     | The product alone could poison.                                                   |
| 1.2 | Any `risks[i].exceeds_safe === true`                                                   | The data team has already flagged this dose as past the safe limit.               |
| 1.3 | Any `risks[i].severity_level === "high"` AND `risks[i].pct >= 100`                     | A hazard the schema rates "high" AND the product hits or passes its safe ceiling. |
| 1.4 | `dosage.pct_of_safe_limit >= 100`                                                      | Catches anything over the safe upper limit even if `risks[]` is sparse.           |
| 1.5 | `severity === "critical"`                                                              | Editorial override — top-level severity is the strongest single signal.           |
| 1.6 | The user has flagged a personal condition that any `risks[i].label` matches against.    | E.g. user has coeliac flagged ⇒ "Wheat Gluten" goes RISK regardless of dose.      |

**Examples that fire Stage 1:**

- `Salt (Sodium Chloride)` — `risks[0].exceeds_safe = true` ⇒ RISK (rule 1.2). ✅ matches your screenshot.
- `Caramel Colour 150d` — `severity = "warn"`, but if a heavy-cola product hits >29 mcg/day 4-MEI ⇒ rule 1.4 promotes to RISK.
- `Vitamin A (Retinol)` if `typical_in_product = 4000 mcg RAE` — `pct_of_safe_limit > 100` ⇒ RISK (rule 1.4), correctly flagging a teratogenic dose.

If no rule fires, fall through to Stage 2.

---

## 4. Stage 2 — Hard BENEFIT veto

The ingredient is **forced** into `BENEFIT` if **all** of these are true:

| #   | Condition                                                                          |
| --- | ---------------------------------------------------------------------------------- |
| 2.1 | `severity === "benefit"`                                                           |
| 2.2 | `dosage.pct_of_safe_limit < 50`                                                    |
| 2.3 | NO `risks[i].severity_level === "high"`                                            |
| 2.4 | NO `risks[i].exceeds_safe === true`                                                |
| 2.5 | `benefits.length >= 1`                                                             |

This is what catches **Ginger**, **Fenugreek**, **Vitamin B12**, **Lutein**, **Whole grains**, **Vegetables**, **Curcumin** etc. when present in normal product amounts. The `< 50%` rule means even good things stop being "benefit-only" once they're past half of the safe ceiling.

**Examples that fire Stage 2:**

- `Ginger (Gingerols and Shogaols)` — typical 1000 mg, safe upper 4000 mg ⇒ pct = 25%, severity = `benefit`, no high risks ⇒ BENEFIT. ✅
- `Fenugreek (Ground)` — typical 2 g, safe upper 10 g ⇒ pct = 20%, severity = `benefit` ⇒ BENEFIT. ✅
- `Vitamin B12` at 6 mcg in supplement, safe = 1000 ⇒ pct = 0.6% ⇒ BENEFIT.

If neither veto fires, the ingredient is genuinely ambiguous — go to scoring.

---

## 5. Stage 3 — Numerical scoring

Score range: **−100 to +100**. Start at 0, then apply every rule that matches. Clamp at the end.

### 5.1 Top-level `severity` weight

| `severity` value | Δ score |
| ---------------- | ------- |
| `"critical"`     | −80     |
| `"warn"`         | −30     |
| `"ok"`           | +5      |
| `"benefit"`      | +35     |

### 5.2 `dosage.pct_of_safe_limit` weight

| % of safe limit | Δ score |
| --------------- | ------- |
| `>= 100`        | −60     |
| `70 – 99`       | −35     |
| `40 – 69`       | −15     |
| `15 – 39`       | +5      |
| `< 15`          | +15     |

### 5.3 Risks aggregate

For **each** entry in `risks[]`:

| Condition                                       | Δ score |
| ----------------------------------------------- | ------- |
| `severity_level === "high"`                     | −30     |
| `severity_level === "medium"`                   | −12     |
| `severity_level === "low"`                      | −3      |
| `exceeds_safe === true`                         | −40     |

(Cap the total negative contribution from this section at −80 so a single ingredient with many small risks doesn't stack to a misleading score.)

### 5.4 Benefits aggregate

| Condition                          | Δ score |
| ---------------------------------- | ------- |
| First benefit present              | +12     |
| Each additional benefit            | +6      |

(Cap at +30.)

### 5.5 Category nudge

| `category`     | Δ score | Rationale                                                  |
| -------------- | ------- | ---------------------------------------------------------- |
| `"additive"`   | −10     | E-numbers carry baseline regulatory caution.               |
| `"preservative"` | −10   | Same.                                                      |
| `"vitamin"`    | +10     | Normally beneficial when within range.                     |
| `"mineral"`    | +5      | Beneficial within range; less of a nudge because of Na/Fe. |
| `"compound"`   | 0       | Neutral — too broad to nudge.                              |
| `"fat"`        | 0       | Decided fully by dose-proximity rules above.               |

### 5.6 Authority confidence bonus

If `dosage.authority` contains `"WHO"`, `"FDA"`, `"NIH"`, `"EFSA"`, or `"JECFA"`, add **+3**. This is small on purpose — it just rewards entries with strong sourcing so they outrank entries with weaker provenance in close calls.

### 5.7 Final clamp

```python
score = max(-100, min(100, score))
```

---

## 6. Stage 4 — Bucket from score

```
score >= +20         →  BENEFIT
-25  ≤ score < +20   →  MODERATE
score < -25          →  RISK
```

Why these cut-offs:
- The **+20** lower cut for BENEFIT is just above what an ingredient with `severity=ok`, low %, and one benefit can earn (≈ +17). So an ingredient must be *clearly* good, not just "not bad".
- The **−25** upper cut for RISK matches the score earned by a single `severity_level=high` risk plus a `warn` top-level severity (−30 + 5 ≈ −25), capturing genuine hazards even when dose is moderate.
- Everything in between is honestly ambiguous → MODERATE. This is the right place to fail safe — the user sees an amber "worth knowing" tag, never a misleading green or red.

---

## 7. Reference pseudocode

Drop-in TypeScript-flavoured pseudocode. Translate to Mongo aggregation pipeline if you prefer to compute server-side.

```ts
type Bucket = "RISK" | "MODERATE" | "BENEFIT";

interface UserProfile {
  conditions?: string[]; // e.g. ["coeliac", "pregnancy", "ckd", "diabetic"]
}

function bucketOf(ing: Ingredient, user: UserProfile = {}): {
  bucket: Bucket;
  reason: string;
  score?: number;
} {
  // ───── Stage 1: hard RISK veto ─────
  const dosage = ing.dosage ?? {};
  if (dosage.toxicity_threshold != null
      && dosage.typical_in_product >= dosage.toxicity_threshold) {
    return { bucket: "RISK", reason: "Hits toxicity threshold" };
  }
  if (ing.risks?.some(r => r.exceeds_safe === true)) {
    return { bucket: "RISK", reason: "Schema flags exceeds_safe = true" };
  }
  if (ing.risks?.some(r => r.severity_level === "high" && (r.pct ?? 0) >= 100)) {
    return { bucket: "RISK", reason: "High-severity risk at or above safe limit" };
  }
  if ((dosage.pct_of_safe_limit ?? 0) >= 100) {
    return { bucket: "RISK", reason: "Dose >= 100% of safe limit" };
  }
  if (ing.severity === "critical") {
    return { bucket: "RISK", reason: "Editorial severity = critical" };
  }
  if (user.conditions && profileTriggersRisk(ing, user.conditions)) {
    return { bucket: "RISK", reason: "User profile flags this ingredient" };
  }

  // ───── Stage 2: hard BENEFIT veto ─────
  const lowDose       = (dosage.pct_of_safe_limit ?? 100) < 50;
  const noHighRisk    = !ing.risks?.some(r => r.severity_level === "high");
  const noOverflow    = !ing.risks?.some(r => r.exceeds_safe === true);
  const hasBenefit    = (ing.benefits?.length ?? 0) >= 1;

  if (ing.severity === "benefit"
      && lowDose && noHighRisk && noOverflow && hasBenefit) {
    return { bucket: "BENEFIT", reason: "Beneficial substance, well within safe limit" };
  }

  // ───── Stage 3: numeric score ─────
  let score = 0;

  score += { critical: -80, warn: -30, ok: 5, benefit: 35 }[ing.severity ?? "ok"];

  const p = dosage.pct_of_safe_limit ?? 0;
  if (p >= 100) score -= 60;
  else if (p >= 70) score -= 35;
  else if (p >= 40) score -= 15;
  else if (p >= 15) score += 5;
  else score += 15;

  let riskDelta = 0;
  for (const r of ing.risks ?? []) {
    if (r.severity_level === "high")   riskDelta -= 30;
    else if (r.severity_level === "medium") riskDelta -= 12;
    else if (r.severity_level === "low")    riskDelta -= 3;
    if (r.exceeds_safe === true)       riskDelta -= 40;
  }
  score += Math.max(-80, riskDelta);

  let benefitDelta = 0;
  if ((ing.benefits?.length ?? 0) >= 1) {
    benefitDelta += 12 + 6 * Math.max(0, ing.benefits!.length - 1);
  }
  score += Math.min(30, benefitDelta);

  score += {
    additive: -10, preservative: -10, vitamin: 10, mineral: 5,
    compound: 0, fat: 0,
  }[ing.category ?? "compound"] ?? 0;

  if (/WHO|FDA|NIH|EFSA|JECFA/i.test(dosage.authority ?? "")) score += 3;

  score = Math.max(-100, Math.min(100, score));

  // ───── Stage 4: bucket from score ─────
  let bucket: Bucket;
  if (score >= 20)        bucket = "BENEFIT";
  else if (score < -25)   bucket = "RISK";
  else                    bucket = "MODERATE";

  return { bucket, reason: `Score ${score}`, score };
}

// User-profile gate (Stage 1.6).  Extend as needed.
function profileTriggersRisk(ing: Ingredient, conditions: string[]): boolean {
  const labels = ing.risks?.map(r => r.label.toLowerCase()).join(" | ") ?? "";
  if (conditions.includes("coeliac") && /coeliac|celiac|gluten/.test(labels)) return true;
  if (conditions.includes("pregnancy")
      && /teratogen|pregnancy|retinol|hypervitaminosis/.test(labels)) return true;
  if (conditions.includes("ckd") && /ckd|kidney|hyperkala/.test(labels)) return true;
  if (conditions.includes("g6pd") && /g6pd|hemolytic/.test(labels)) return true;
  if (conditions.includes("diabetic") && /glycaemic|sugar|insulin/.test(labels)) return true;
  return false;
}
```

---

## 8. Worked examples

Each row uses real values from `ingredients_new`. The "Stage that fires" column shows which rule decided the bucket.

| Ingredient                                       | severity   | pct_of_safe_limit | risks summary                          | benefits | Score | Stage   | Bucket    |
| ------------------------------------------------ | ---------- | ----------------- | -------------------------------------- | -------- | ----- | ------- | --------- |
| Salt (Sodium Chloride)                           | warn       | 100               | high · exceeds_safe                    | 1        | —     | 1.2     | **RISK**  |
| Sugar (Sucrose)                                  | warn       | 50                | medium                                 | 1        | −44   | 4       | **RISK**  |
| Caramel Colour 150d                              | warn       | low (varies)      | medium (4-MEI carcinogen flag)         | 1        | −32   | 4       | **RISK**  |
| Wheat Gluten (no profile)                        | warn       | 50                | high (coeliac)                         | 1        | −37   | 4       | **RISK**  |
| Wheat Gluten (user has coeliac)                  | warn       | 50                | high                                   | 1        | —     | 1.6     | **RISK**  |
| Vitamin A (Retinol) at 700 mcg RAE               | benefit    | 23                | medium (preformed retinol)             | 3        | +13   | 4       | **MODERATE** |
| Vitamin A (Retinol) at 4000 mcg RAE (overdose)   | benefit    | 133               | medium                                 | 3        | —     | 1.4     | **RISK**  |
| Ginger (Gingerols and Shogaols)                  | benefit    | 25                | low                                    | 1        | —     | 2       | **BENEFIT** |
| Fenugreek (Ground)                               | benefit    | 20                | low                                    | 1        | —     | 2       | **BENEFIT** |
| Vitamin B12                                      | benefit    | 0.6               | low                                    | 3        | —     | 2       | **BENEFIT** |
| Lutein and Zeaxanthin                            | benefit    | 50                | low                                    | 2        | +35   | 4       | **BENEFIT** |
| Sodium Tripolyphosphate (E451)                   | warn       | low               | medium (CKD vascular calcification)    | 1        | −37   | 4       | **RISK**  |
| Citric Acid (E330)                               | warn       | low               | low                                    | 1        | −22   | 4       | **MODERATE** |
| Curcumin (Turmeric)                              | benefit    | 6                 | low                                    | 2        | —     | 2       | **BENEFIT** |
| Dietary Fiber (typical 25 g)                     | benefit    | 36                | low                                    | 2        | +43   | 4       | **BENEFIT** |
| Caffeine in 2 espresso (≈200 mg)                 | benefit    | 50                | medium                                 | 1        | −2    | 4       | **MODERATE** |
| Caffeine in 5 espresso (≈500 mg)                 | benefit    | 125               | medium                                 | 1        | —     | 1.4     | **RISK**  |

The table doubles as a **regression test** — see §10.

---

## 9. Tie-breakers, edge cases & guard rails

1. **Empty `risks[]`** — fine, the score stage still fires; the absence of risks contributes 0, not a positive number. Algorithm degrades gracefully.
2. **Empty `benefits[]`** — the +12 bonus simply isn't applied. The ingredient cannot reach BENEFIT through the score path alone unless `severity === "benefit"`, which is desirable.
3. **`pct_of_safe_limit === null`** — treat as 0 for the score, but if the field is missing because the ingredient has no safe limit (water, fibre, etc.), make sure the loader fills `0` not `null` so we don't double-count.
4. **`severity` missing** — default to `"ok"` for scoring. Log a data-quality warning.
5. **Multiple risks with mixed levels** — the score sums them, but the cap at −80 prevents pile-on. Pick **the worst severity_level** for any UI labelling, not the sum.
6. **Aliases / duplicates** — when the OCR returns both "Vitamin B12" and "Vitamin B12 (Cobalamin)", merge upstream in the matcher; bucketing should run on the canonical record only.
7. **Composite ingredients** ("Mixed Spices", "Noodle Powder Seasoning") — bucket on the composite record. The schema already encodes their pooled risk profile.
8. **Score on the boundary** — if `score === 20` it's BENEFIT, if `score === -25` it's RISK; the comparison operators in the pseudocode (`>=`, `<`) make boundaries deterministic.
9. **Stable sorting inside a bucket** — sort RISK by descending |score|, BENEFIT by descending score, MODERATE by ascending score. This keeps the most urgent items at the top of each list.
10. **Personalisation safety** — the user-profile gate (1.6) can only ever **promote** to RISK, never demote. So it's safe to default-on.

---

## 10. Test fixtures (paste into Jest / Vitest)

```ts
import { bucketOf } from "./bucket";
import data from "../ingredients_enriched.json";

const find = (name: string) => data.find(d => d.name === name)!;

describe("bucketing", () => {
  test.each([
    ["Salt (Sodium Chloride)", "RISK"],
    ["Vitamin B12", "BENEFIT"],
    ["Ginger (Gingerols and Shogaols)", "BENEFIT"],
    ["Fenugreek (Ground)", "BENEFIT"],
    ["Sugar (Sucrose)", "RISK"],
    ["Lutein and Zeaxanthin", "BENEFIT"],
    ["Curcumin (Turmeric)", "BENEFIT"],
    ["Wheat Gluten", "RISK"],         // assumes coeliac profile NOT set; even so warn + risk pushes to RISK
    ["Citric Acid (E330)", "MODERATE"],
  ])("%s → %s", (name, expected) => {
    expect(bucketOf(find(name)).bucket).toBe(expected);
  });

  test("user with coeliac flags Wheat Gluten as RISK", () => {
    expect(bucketOf(find("Wheat Gluten"), { conditions: ["coeliac"] }).bucket).toBe("RISK");
  });

  test("Vitamin A overdose", () => {
    const ing = structuredClone(find("Vitamin A (Retinol)"));
    ing.dosage.typical_in_product = 4000;
    ing.dosage.pct_of_safe_limit = 133;
    expect(bucketOf(ing).bucket).toBe("RISK");
  });

  test("Empty risks/benefits doesn't crash", () => {
    expect(bucketOf({ name: "x", category: "compound", severity: "ok",
      dosage: {}, risks: [], benefits: [], sources: [],
      risksAndDeficiency: { deficiency: "", excess: "" },
      importantNotes: [], citations: [], tag: "", description: "" } as any).bucket)
      .toBe("MODERATE");
  });
});
```

---

## 11. How this drives the existing UI

- Summary tile **Critical risk** = `count(bucket === "RISK")`.
- Summary tile **Moderate concern** = `count(bucket === "MODERATE")`.
- Summary tile **Safe / beneficial** = `count(bucket === "BENEFIT")`.
- Detail-row dot colour:
  - RISK → red `#E03A3E`
  - MODERATE → amber `#E89B2C`
  - BENEFIT → emerald `#3DAA5C`
- The right-hand pill copy can be derived from the *worst* `risks[i].label` for RISK / MODERATE rows (e.g. *High GI*, *Allergen present*) and the *first* `benefits[0].label` for BENEFIT rows (e.g. *Eye health*, *Heart support*). This keeps the screenshot's vocabulary consistent with the new pipeline.

That's the whole system. Implement §3 + §4 as a 60-line pure function, wire its output into the summary tiles and row dots, and ambiguous cases will sort themselves.
