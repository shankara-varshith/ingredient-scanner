import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Ingredient from "@/models/Ingredient";
import IngredientAlias from "@/models/IngredientAlias";
import { levenshteinDistance } from "@/utils/levenshtein";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = await req.json();
    const extracted_ingredients: string[] = body.extracted_ingredients;

    if (!extracted_ingredients || !Array.isArray(extracted_ingredients)) {
      return NextResponse.json(
        { error: "Invalid request, expected extracted_ingredients array" },
        { status: 400 }
      );
    }

    // Fetch all ingredients and aliases once since the collection is small
    const allIngredients = await Ingredient.find({}).lean();
    const allAliases = await IngredientAlias.find({}).lean();

    const matched: any[] = [];
    let unmatched: string[] = [];
    const matchedNamesSet = new Set<string>();

    for (const raw of extracted_ingredients) {
      const rawLower = raw.toLowerCase().trim();
      if (!rawLower) continue;

      let found = null;

      // 1. Case-insensitive exact match
      found = allIngredients.find(ing => ing.name.toLowerCase() === rawLower);

      // 2. Fuzzy match (Levenshtein <= 2)
      if (!found) {
        found = allIngredients.find(ing => levenshteinDistance(ing.name.toLowerCase(), rawLower) <= 2);
      }

      // 3. Contains match
      if (!found) {
        found = allIngredients.find(ing => 
          ing.name.toLowerCase().includes(rawLower) || 
          rawLower.includes(ing.name.toLowerCase())
        );
      }

      // 4. Known-alias table
      if (!found) {
        const aliasMatch = allAliases.find(alias => alias.alias.toLowerCase() === rawLower);
        if (aliasMatch) {
          found = allIngredients.find(ing => ing.name === aliasMatch.matched_name);
        }
      }

      // If still not found, try alias fuzzy/contains (optional, but good)
      if (!found) {
         const aliasMatch = allAliases.find(alias => 
            levenshteinDistance(alias.alias.toLowerCase(), rawLower) <= 2 ||
            alias.alias.toLowerCase().includes(rawLower) ||
            rawLower.includes(alias.alias.toLowerCase())
         );
         if (aliasMatch) {
           found = allIngredients.find(ing => ing.name === aliasMatch.matched_name);
         }
      }

      if (found) {
        // Prevent duplicate results if multiple raw tokens map to the same ingredient
        if (!matchedNamesSet.has(found.name)) {
          matched.push({
            raw,
            matched_name: found.name,
            id: found._id.toString(),
            ...found // return all fields from the new schema
          });
          matchedNamesSet.add(found.name);
        }
      } else {
        unmatched.push(raw);
      }
    }

    // Try to auto-generate any remaining unmatched ingredients via Gemini
    if (unmatched.length > 0) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `
You are a scientific expert on food and cosmetic ingredients.
I have a list of unmatched ingredients from an OCR scan: ${JSON.stringify(unmatched)}.
For each real ingredient in this list, generate a detailed profile according to the exact JSON schema provided below.
Return ONLY a valid JSON array containing the newly generated ingredient objects. Do not include markdown codeblocks or any other text.
If an item is not a real ingredient or is too ambiguous, simply skip it.

Schema for each ingredient (must strictly follow this):
{
  "name": "Proper Name",
  "category": "category string (e.g. vitamin, preservative, etc)",
  "severity": "benefit" | "ok" | "warn" | "critical",
  "tag": "Short tag (e.g. Essential vitamin, Artificial color)",
  "description": "Short description",
  "dosage": {
    "unit": "mcg/day, mg/day, g/day, %, etc",
    "typical_in_product": 0,
    "rda": 0,
    "safe_upper_limit": 0,
    "tolerable_upper_limit": 0,
    "toxicity_threshold": null,
    "pct_of_safe_limit": 0,
    "authority": "NIH/FDA/EFSA/etc",
    "special_conditions": { "pregnancy": 0 }
  },
  "risks": [
    {
      "label": "Risk name",
      "actual": 0,
      "safe": 0,
      "max": 0,
      "unit": "unit",
      "pct": 0,
      "severity_level": "low" | "medium" | "high",
      "exceeds_safe": false,
      "context": "Context description",
      "citation": "URL"
    }
  ],
  "benefits": [
    {
      "label": "Benefit name",
      "category": "Benefit category",
      "actual": 0,
      "safe": 0,
      "max": 0,
      "unit": "unit",
      "pct": 0,
      "context": "Context description",
      "citation": "URL"
    }
  ],
  "sources": ["Source 1", "Source 2"],
  "risksAndDeficiency": {
    "deficiency": "Deficiency details",
    "excess": "Excess details"
  },
  "importantNotes": ["Note 1"],
  "citations": ["URL"]
}
        `;

        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        });
        
        const textResponse = result.response.text();
        let cleanedJson = textResponse;
        
        // Remove markdown tags if they are still present
        const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          cleanedJson = jsonMatch[1];
        } else {
          cleanedJson = cleanedJson.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
        }

        const newlyGeneratedIngredients = JSON.parse(cleanedJson);

        if (Array.isArray(newlyGeneratedIngredients) && newlyGeneratedIngredients.length > 0) {
          for (const newIng of newlyGeneratedIngredients) {
            delete newIng._id; // Ensure we don't try to write an invalid/existing ID
            try {
              // Upsert to handle unique name constraints safely
              const savedIng = await Ingredient.findOneAndUpdate(
                { name: newIng.name },
                { $set: newIng },
                { upsert: true, new: true, runValidators: true }
              );
              
              // Map back to corresponding raw token
              const correspondingRaw = unmatched.find(u => 
                newIng.name.toLowerCase().includes(u.toLowerCase()) || 
                u.toLowerCase().includes(newIng.name.toLowerCase()) ||
                levenshteinDistance(u.toLowerCase(), newIng.name.toLowerCase()) <= 3
              ) || newIng.name;

              matched.push({
                raw: correspondingRaw,
                matched_name: savedIng.name,
                id: savedIng._id.toString(),
                ...savedIng.toObject()
              });
              
              // Remove handled token from unmatched list
              unmatched = unmatched.filter(u => u !== correspondingRaw);
            } catch (err) {
              console.error("Failed to save newly generated ingredient:", err);
            }
          }
        }
      } catch (err) {
        console.error("Failed to generate missing ingredients via Gemini:", err);
      }
    }

    return NextResponse.json({
      extracted_ingredients,
      matched,
      unmatched
    });
  } catch (error: any) {
    console.error("Error identifying ingredients:", error);
    return NextResponse.json(
      { error: "Failed to identify ingredients", details: error.message },
      { status: 500 }
    );
  }
}
