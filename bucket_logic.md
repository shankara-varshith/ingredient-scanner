# Bucket Classification Logic — Risks · Moderate · Benefits

## Goal
Given (a) a record from `ingredients_new` and (b) the **actual amount** of that ingredient in the scanned product, decide which of the three summary tiles it counts toward:

- **risk** — the ingredient is harmful in this product, full stop.
- **moderate** — concerning if eaten heavily; fine in this serving.
- **benefit** — actively good for the consumer (or essential nutrient at adequate dose).

The logic must be deterministic, explainable, and never give a contradictory answer for the same input.

---

## Why a single rule isn't enough

Two failure modes break naive approaches:

| Approach | Fails on |
|---|---|
| Pure dose math (`actual ≥ safe_upper_limit?`) | **Peanut protein** at 0.1 g — anaphylaxis is dose-independent for the allergic 2 % of users. |
| Pure tag matching (`severity == "warn"`?) | **Salt** in a tea bag (3 mg) — labelled "warn" but harmless at that dose. |

So the classifier runs in **layers**: qualitative overrides first, quantitative gates second, score-based tiebreaker last.

---

## Inputs

```
record  = full document from ingredients_new
actual  = amount of this ingredient in the scanned product, in `record.dosage.unit`
         (if OCR can't extract a quantity, fall back to record.dosage.typical_in_product)
```

## Pre-computed runtime values

```
safe      = record.dosage.safe_upper_limit
tol       = record.dosage.tolerable_upper_limit
tox       = record.dosage.toxicity_threshold       # may be null
rda       = record.dosage.rda
pct_safe  = (actual / safe) * 100   if safe else 0
pct_rda   = (actual / rda)  * 100   if rda  else 0
top_sev   = record.severity                        # critical | warn | ok | benefit
risk_max  = max severity_level across record.risks # high | medium | low | none
ben_count = len(record.benefits)
```

---

## Layer 1 — Qualitative RISK overrides (dose-independent)

These are **always RISK regardless of `actual`** because the harm is binary, not graded.

A record hits this layer if **any** of the following text matches (case-insensitive):

| Field | Keyword |
|---|---|
| `tag` | `allergen`, `carcinogen`, `toxic`, `hazard` |
| `risks[].label` | `anaphylaxis`, `carcinogen`, `IARC Group`, `celiac`, `PKU`, `neurotoxic`, `teratogen` |
| `risks[].context` | `IARC`, `top-9 allergen`, `anaphylaxis`, `pregnancy must avoid`, `kernicterus` |

Examples that fall into RISK by Layer 1:
- **Hydrolysed Groundnut (Peanut) Protein** — top-9 allergen.
- **Caramel Colour 150d** — IARC 2B for 4-MEI.
- **Wheat Gluten** — coeliac autoimmune trigger.

If the consumer has a verified **profile flag** disabling that condition (e.g. "I have no nut allergy"), the rule is skipped for them and the record drops to Layer 2. Without a profile, treat the population-level rule as authoritative.

---

## Layer 2 — Quantitative RISK gates

A record is RISK if **any** of:

1. `tox` is not null and `actual ≥ tox` *(crossed toxicity threshold)*.
2. `actual ≥ safe` *(crossed safe upper limit)*.
3. `top_sev == "critical"` *(authoritative critical flag)*.
4. `risk_max == "high"` AND `pct_safe ≥ 80` *(close to safe limit and risk is severe)*.

Examples:
- **Salt** in instant noodles where the sachet alone supplies 2.5 g sodium (>safe 2 g). Rule 2 fires.
- **Vitamin A** retinol palmitate at 4000 mcg in a fortified shot (>tol 3000). Rule 2.

---

## Layer 3 — Qualitative BENEFIT rules

A record is BENEFIT if **all** of:

- `top_sev == "benefit"` *(authoritative benefit flag)*.
- `risk_max ∈ {"low", "none"}` *(no medium/high risk at all)*.
- `pct_safe < 50` *(comfortably below safe limit)*.
- `ben_count ≥ 1` *(record actually documents a benefit)*.

Or the **essential-nutrient sweet spot**:

- `category ∈ {vitamin, mineral}` AND
- `0.3 × rda ≤ actual ≤ 1.5 × rda` *(meaningful dose without overshoot)* AND
- `pct_safe < 50`.

Examples that fall into BENEFIT:
- **Fenugreek (Ground)** — 2 g serving, severity=benefit, low-severity risk only, pct_safe=20 %.
- **Ginger (Ground)** — same pattern.
- **Vitamin C** — 60 mg in a fortified juice = 67 % RDA, pct_safe=3 %.

---

## Layer 4 — Quantitative MODERATE gates

A record is MODERATE if **any** of:

1. `50 ≤ pct_safe < 100` *(more than half the safe limit)*.
2. `risk_max == "medium"` AND `pct_safe ≥ 30`.
3. `top_sev == "warn"` AND not already RISK *(authoritative warn flag, but dose is OK)*.
4. `category == "additive"` and not already RISK or BENEFIT.

---

## Layer 5 — Score-based tiebreaker

Reaches this layer only when none of Layers 1-4 fire. Computes a single concern score `S` and buckets by threshold.

```
S = 0

# Risk pressure
S += 60 if any risk has severity_level == "high"   else 0
S += 30 if any risk has severity_level == "medium" else 0
S += 10 if any risk has severity_level == "low"    else 0

# Dose modulation: scales the risk pressure by how close we are to the safe limit
S *= clamp(pct_safe / 100, 0.1, 2.0)

# Benefit pressure
S -= 20 * min(ben_count, 3)               # max −60 from benefits
S -= 20 if 0.5*rda <= actual <= 1.5*rda   # essential-nutrient sweet spot
       and category in {"vitamin","mineral"} else 0

# Top-level adjustment
S += {"critical": 40, "warn": 20, "ok": 0, "benefit": -30}[top_sev]

# Category bias
S += {"additive": 20, "preservative": 15,
      "vitamin": -10, "mineral": -10,
      "compound": -10, "fat": 0}.get(category, 0)
```

Bucket:

| Score range | Bucket |
|---|---|
| `S ≥ +25` | risk |
| `−10 ≤ S < +25` | moderate |
| `S < −10` | benefit |

The score is rarely needed — most records resolve in layers 1-4 — but it gives a defined answer for every input.

---

## Worked examples

| Ingredient | actual | safe | risk_max | top_sev | Layer fired | Bucket |
|---|---|---|---|---|---|---|
| Hydrolysed peanut protein | 2 g | 20 g | high | warn | L1 (top-9 allergen) | **risk** |
| Salt (Maggi sachet) | 2.5 g | 2 g | high | warn | L2 rule 2 (`actual ≥ safe`) | **risk** |
| Caramel Colour 150d | 0.05 mg/kg | 200 mg/kg | medium | warn | L1 (IARC 2B) | **risk** |
| Refined wheat flour | 80 g | 300 g | medium | ok | L4 rule 4 (additive-like, refined) | **moderate** |
| Sugar | 25 g | 50 g | high | warn | L4 rule 1 (50 % of safe) | **moderate** |
| Wheat gluten (no profile) | 10 g | 20 g | high | warn | L1 (celiac) | **risk** |
| Wheat gluten (user toggled "no celiac") | 10 g | 20 g | high | warn | L4 rule 1 | **moderate** |
| Fenugreek (ground) | 2 g | 10 g | low | benefit | L3 (sweet spot) | **benefit** |
| Ginger (ground) | 1 g | 6 g | low | benefit | L3 | **benefit** |
| Vitamin C | 60 mg | 2000 mg | low | benefit | L3 essential-nutrient | **benefit** |
| Vitamin C (megadose) | 3000 mg | 2000 mg | low | benefit | L2 rule 2 | **risk** |
| Curcumin | 500 mg | 8000 mg | low | benefit | L3 | **benefit** |
| Beta-Carotene (smoker) | 25 mg | 20 mg | medium | benefit | L2 rule 2 + L1 if smoker-flag | **risk** |

---

## Key design principles

1. **Qualitative beats quantitative** — Layer 1 runs first because allergens and carcinogens cause harm at trace doses. No amount of "low pct_of_safe" should override an anaphylaxis trigger.
2. **`exceeds_safe` is a hard line, not a suggestion** — once `actual ≥ safe`, the ingredient is RISK regardless of how many benefits the record lists.
3. **Personalisation via profile flags** — users can disable specific qualitative rules they don't share (no peanut allergy, no celiac), but never relax quantitative ones. This keeps population-level safety as the default.
4. **The score only runs when nothing else fires** — most ingredients reach a verdict in 4 cheap rule checks. The score exists to give an unambiguous answer to weird records, not to be the primary mechanism.
5. **Output a trace, not just a label** — every classification returns a list of which rules fired. The UI can show "Why?" tooltips and the data team can audit edge cases.

---

## Tunables (one place to adjust thresholds)

```
HIGH_RISK_PCT_SAFE      = 80       # Layer 2 rule 4
MODERATE_PCT_SAFE_LOW   = 50       # Layer 4 rule 1
MODERATE_PCT_SAFE_MED   = 30       # Layer 4 rule 2
ESSENTIAL_RDA_FLOOR     = 0.3      # Layer 3 sweet-spot floor (×rda)
ESSENTIAL_RDA_CEIL      = 1.5      # Layer 3 sweet-spot ceiling (×rda)
SCORE_RISK_THRESHOLD    = 25
SCORE_BENEFIT_THRESHOLD = -10

QUALITATIVE_RISK_KEYWORDS = [
    "allergen", "carcinogen", "toxic", "hazard",
    "anaphylaxis", "iarc group", "celiac", "pku",
    "neurotoxic", "teratogen", "top-9 allergen",
    "kernicterus",
]
```

Everything else flows from these. Change a number, retest the example table, ship.
