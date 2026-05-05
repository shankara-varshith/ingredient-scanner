import { classifyIngredient } from "./src/utils/bucketClassifier";

const testTurmeric = {
  "name": "Turmeric (Ground)",
  "category": "compound",
  "severity": "benefit",
  "tag": "Curcumin powder",
  "description": "Dried Curcuma longa rhizome ground to a yellow powder rich in curcumin.",
  "dosage": {
    "unit": "g/day",
    "typical_in_product": 2,
    "rda": 2,
    "safe_upper_limit": 10,
    "tolerable_upper_limit": 20,
    "toxicity_threshold": null,
    "pct_of_safe_limit": 20.0,
    "authority": "EFSA/JECFA",
    "special_conditions": {}
  },
  "risks": [
    {
      "label": "Allergy / drug interaction",
      "actual": 2,
      "safe": 10,
      "max": 20,
      "unit": "g/day",
      "pct": 20.0,
      "severity_level": "low",
      "exceeds_safe": false,
      "context": "High doses may interact with anticoagulants; rare allergy possible.",
      "citation": "..."
    }
  ],
  "benefits": []
};

console.log("Turmeric bucket:", classifyIngredient(testTurmeric, 0));
