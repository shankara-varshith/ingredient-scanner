import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Ingredient from "@/models/Ingredient";

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const { ingredients } = await req.json();

    if (!ingredients || !Array.isArray(ingredients)) {
      return NextResponse.json(
        { error: "Invalid request, expected an array of ingredients" },
        { status: 400 }
      );
    }

    const escapeRegExp = (string: string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    };

    if (ingredients.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Match ingredients against our DB (using word boundary to match partial strings like 'Vitamin C' within 'Ascorbic Acid (Vitamin C)')
    const regexQueries = ingredients.map((name: string) => ({
      name: { $regex: new RegExp(`\\b${escapeRegExp(name)}\\b`, "i") }
    }));

    const results = await Ingredient.find({
      $or: regexQueries
    });

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("Error fetching ingredients:", error);
    return NextResponse.json(
      { error: "Failed to fetch ingredients", details: error.message },
      { status: 500 }
    );
  }
}
