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

    // Match ingredients (case-insensitive) against our DB
    const results = await Ingredient.find({
      name: { $in: ingredients.map((name: string) => new RegExp(`^${name}$`, "i")) },
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
