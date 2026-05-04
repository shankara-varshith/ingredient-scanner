# Antigravity Brief — Ingredient Scanner v2

## Goal
Upgrade the scan-result page (https://ingredient-scanner-phi.vercel.app/) to read from the newly enriched MongoDB collection and present the richer dosage / risk / benefit data in a more legible, modern UI. Also add a "what we identified" section so the user can see exactly which ingredients the OCR pipeline picked up and which we have authoritative data for.

The end-user is a non-technical consumer scanning a packaged food/cosmetic. The page must be **scannable in 5 seconds** (top summary), **drill-downable in one tap** (ingredient detail), and **never cluttered**.

---

## 1. Backend changes

### 1.1 Switch the data source
Change the Mongo collection reference from `ingredients` to `ingredients_new` in the same `test` database. Search the codebase for every place that hard-codes the old name — likely candidates:

```
db.collection("ingredients")
mongoose.model("Ingredient", schema, "ingredients")
const COLLECTION = "ingredients"
```

Replace each occurrence with `ingredients_new`. Keep the connection string, db name and credentials untouched. The old `ingredients` collection should remain untouched as a fallback.

### 1.2 New schema fields the API must surface
The new collection adds these top-level fields per record. The API must return all of them — do not strip:

```
name, category, severity, tag, description,
dosage: { unit, typical_in_product, rda, safe_upper_limit,
          tolerable_upper_limit, toxicity_threshold,
          pct_of_safe_limit, authority, special_conditions },
risks:    [ { label, actual, safe, max, unit, pct,
              severity_level, exceeds_safe, context, citation } ],
benefits: [ { label, category, actual, safe, max, unit, pct,
              context, citation } ],
sources, risksAndDeficiency, importantNotes, citations
```

### 1.3 New endpoint — `/api/scan/identify`
After OCR/text extraction, return:

```jsonc
{
  "extracted_ingredients": ["Refined wheat flour", "Salt", "MSG-635", ...], // raw OCR tokens
  "matched": [
    { "raw": "Refined wheat flour", "matched_name": "Wheat Flour", "id": "..." },
    { "raw": "Salt",                "matched_name": "Salt (Sodium Chloride)", "id": "..." }
    // only entries we found in ingredients_new
  ],
  "unmatched": ["MSG-635"]    // tokens we could not resolve
}
```

Matching rules: case-insensitive exact → fuzzy (Levenshtein ≤ 2) → contains → known-alias table (`refined wheat flour → Wheat Flour`, `e635 → Flavour Enhancer (635) - Disodium 5'-Ribonucleotides`, etc.). Persist alias rules in a small `ingredient_aliases` collection so we can extend it without a deploy.

---

## 2. Frontend — page structure (top to bottom)

```
[ HEADER: product name + scan-image thumb + re-scan button ]
[ STAGE 1 — Identification panel ]
[ STAGE 2 — Summary tiles  (Critical / Moderate / Safe-or-Beneficial) ]
[ STAGE 3 — Filter tabs    (Risks | Benefits | All) ]
[ STAGE 4 — Ingredient detail rows (collapsible, with gauge bars) ]
[ FOOTER: data sources + disclaimer ]
```

### 2.1 STAGE 1 — Identification panel  (NEW)
Tells the user "we found 11 ingredients on the label, we have data for 8 of them."

Layout:

```
We identified  11 ingredients              [ 8 in our database ]
───────────────────────────────────────────────────────────────
[Refined wheat flour]  [Salt]  [Sugar]  [Wheat gluten]
[Hydrolysed groundnut protein]  [Mixed spices]
[Flavour enhancer 635]  [Caramel colour 150d]  [Citric acid]
[E631]  [Unknown stabiliser]
```

Visual rules:
- Each ingredient rendered as a **chip / pill**.
- Chips that exist in `matched[]` → **green border + green dot**, `cursor: pointer`, hover lifts shadow.
- Chips in `unmatched[]` → **muted grey border, no dot**, `cursor: default`, tooltip: "We don't have data on this one yet."
- Click on a green chip → smoothly scroll the page to that ingredient's row in STAGE 4 and auto-expand it. Use `scrollIntoView({ behavior: 'smooth', block: 'center' })` and add a 1.5s highlight pulse on the target row.
- Click on a grey chip → no-op (no scroll, no expand).
- Above the chips, a counter: `We identified <N> ingredients` and a badge `<M> in our database` (M green, N-M grey).

### 2.2 STAGE 2 — Summary tiles  (KEEP, polish)
Three tiles already on the page. Drive their counts from `severity_level` aggregation across the matched ingredients:
- **Critical risk** = count of ingredients where any `risks[].severity_level === "high"` OR `exceeds_safe === true`.
- **Moderate concern** = severity_level === "medium".
- **Safe / beneficial** = severity_level === "low" AND has at least one benefit, OR top-level `severity` is `ok`/`benefit`.

Polish: increase number size to ~48 px, label tracking +0.5 px, give each tile a thin coloured top-border (red / amber / emerald) instead of full-card colour washes — feels lighter on a dark background.

### 2.3 STAGE 3 — Filter tabs  (KEEP, polish)
Tabs: `Risks` | `Benefits` | `All`. Underline-style active tab (no full pill background). Keyboard navigable.

### 2.4 STAGE 4 — Ingredient detail row  (UPGRADE)
Each row is collapsible. Header always visible:

```
●  Refined wheat flour                          [High GI]   ⌄
```

When expanded, render in this order:

#### A. Hero gauge bar  (one per active tab — risk OR benefit)
Replace the current single-bar layout with a **scaled gauge** that exposes the four key thresholds from the new schema. Use the existing soft-amber/red palette for the fill; the rest of the bar must be a low-contrast track so it doesn't dominate.

```
Blood sugar spike                          70 GI  ·  safe limit 55 GI
├──────────●─────────┼──────────────────────────┤
0          actual    safe                       max
                     │
                     │  rda marker (small chevron above the bar)
```

Required ticks/markers on the bar (left → right):
1. **Origin (0)** — implicit.
2. **RDA chevron** — small downward triangle above the track at `rda / max`. Tooltip: "Recommended daily allowance".
3. **Actual fill** — coloured fill ending at `actual / max`. Colour driven by `severity_level`: low → emerald, medium → amber, high → red.
4. **Safe-limit line** — vertical bar at `safe / max`, label below "safe limit".
5. **Max** — track ends here, label "max" below right.
6. If `toxicity_threshold` exists, render a second red dashed line and label "toxicity".

Rules:
- All numbers respect `unit` from the schema (mg/day, mcg/day, g/day, GI, CFU/day, %, etc.). Show the unit once at the right end of the bar (e.g. `70 GI · safe limit 55 GI`).
- If `actual > safe`, the fill colour goes red and a small ⚠ icon appears at the right of the label row.
- Bar height: 8 px. Track radius: full pill. Animate fill width on expand (300 ms ease-out).

#### B. Plain-language explanation  (KEEP)
Use `risks[0].context` (or `benefits[0].context` on the Benefits tab). Max 2 short sentences, no jargon.

#### C. Why-this-matters block  (NEW, optional)
Below the explanation, a compact 3-line block:

```
🩺  RDA (healthy adult)         2.4 mcg/day
🛡  Safe upper limit            1000 mcg/day
📚  Source                      NIH ODS  ↗
```

- Pull `dosage.rda`, `dosage.safe_upper_limit`, `dosage.authority`.
- The Source row is a link → first URL in `citations[]`. Open in new tab, `rel="noopener"`.
- Hide this block on mobile by default behind a "Show data sources" caret to keep the row short.

#### D. Special conditions chip row  (NEW, conditional)
If `dosage.special_conditions` is non-empty, render small grey chips:

```
[Pregnancy 2.6 mcg]  [Lactation 2.8 mcg]  [Elderly 2.4 mcg]
```

Only render if the user has flagged a relevant profile (Settings → Health profile) — otherwise hide. This keeps the UI uncluttered for the common case.

#### E. Sources / important notes  (NEW, collapsible)
A "Show details" toggle reveals:
- Bullet list from `importantNotes[]`.
- Bullet list from `sources[]` ("Found naturally in:").
- All `citations[]` rendered as numbered links.

This sub-collapse stays closed by default.

---

## 3. Visual & interaction polish

### 3.1 Theme & spacing
- Move to a **single dark canvas** (`#0B0B0B`) with **off-white card surfaces** (`#FAFAF7`). Current page mixes those well — keep the contrast but tighten card radii to 14 px and shadows to a single soft layer (`0 1px 2px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)`).
- Consistent vertical rhythm: 24 px between major sections, 12 px between rows inside a section.
- Replace the colour-flooded headers ("Critical risk" red bg, etc.) with a thin top-border treatment as described in 2.2.

### 3.2 Severity dots
Use 10 px filled circles, never coloured rectangles. Palette:
- High / critical → `#E03A3E`
- Medium / warn → `#E89B2C`
- Low / ok → `#3DAA5C`
- Benefit → `#2F8F6E` (slightly different from "ok" green to suggest "good for you")

### 3.3 Typography
- Display (numbers in tiles): Inter Tight 600, 48/52.
- Body: Inter 400, 15/22.
- Caps labels ("RISKS — CLICK ANY INGREDIENT…"): Inter 500, 11/16, letter-spacing 0.12 em, opacity 0.55.
- One typeface family everywhere. No serifs.

### 3.4 Motion
- Row expand: 220 ms ease-out for height + opacity.
- Gauge fill: 300 ms ease-out width.
- Scroll-target highlight: 1.5 s background-color pulse from `rgba(61,170,92,0.18)` to transparent.

### 3.5 Mobile
- Tiles stack 1-up at < 480 px.
- Gauge bars stay 8 px tall, but the labels collapse into a single line: `actual / safe (unit)`.
- Identification chips wrap; never horizontal-scroll.

### 3.6 Accessibility
- All severity meaning must NOT rely on colour alone — use the dot + the right-aligned tag (`High GI`, `Low concern`, etc.).
- Gauge bars get `role="progressbar"` with `aria-valuenow / valuemin / valuemax / valuetext`.
- Keyboard: chips and rows fully `Tab`-navigable, `Enter`/`Space` triggers expand or scroll.
- Colour contrast ≥ 4.5:1 for body, ≥ 3:1 for non-text indicators.

---

## 4. Acceptance criteria

A pull request is mergeable when:

1. The app reads from `ingredients_new` and the old collection is no longer referenced anywhere.
2. Scanning an image with at least 5 known ingredients renders:
   - Identification panel with correct match/unmatch counts.
   - Green chips clickable and grey chips inert.
   - Clicking a green chip smooth-scrolls to and expands the matching detail row with a brief highlight pulse.
3. For every matched ingredient, the gauge bar correctly plots `actual` / `rda chevron` / `safe limit line` / `max`, using the unit from `dosage.unit`.
4. Critical / Moderate / Safe tile counts match the rules in §2.2 on a hand-checked sample of 20 ingredients.
5. "Show details" reveals `importantNotes`, `sources`, and citation links — all opening in a new tab.
6. Lighthouse: Accessibility ≥ 95, Performance ≥ 85 on mobile.
7. No console errors, no layout shift > 0.1 CLS on first render.

---

## 5. Out of scope (do not do in this PR)
- Auth changes.
- New OCR provider.
- Push notifications.
- Multi-language support (English-only ship, i18n later).
- Editing the `ingredients_new` data — content is owned by the data team.

---

## 6. Reference assets
- Sample MongoDB collection: `test.ingredients_new` (230 docs).
- Schema sample: see `ingredients_enriched.json` in repo root.
- Visual reference: attached screenshot of current page (`Maggi Masala noodles` example).
