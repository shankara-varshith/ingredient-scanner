import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Ingredient from "@/models/Ingredient";
import IngredientAlias from "@/models/IngredientAlias";
import { levenshteinDistance } from "@/utils/levenshtein";

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

    const matched = [];
    const unmatched = [];
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
