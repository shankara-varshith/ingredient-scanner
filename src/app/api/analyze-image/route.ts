import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      Analyze this image, which is a product label. 
      Extract the list of ingredients and classify the product type.
      Respond ONLY with a valid JSON object using the following structure:
      {
        "productType": "Food" | "Beauty/Cosmetics" | "Supplement" | "Other",
        "ingredients": ["Ingredient 1", "Ingredient 2"]
      }
      Do not include markdown tags, only raw JSON.
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: file.type || "image/jpeg",
        },
      },
    ]);

    const textResponse = result.response.text();
    let cleanedJson = textResponse;
    const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      cleanedJson = jsonMatch[1];
    } else {
      cleanedJson = cleanedJson.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    }

    const parsedData = JSON.parse(cleanedJson);

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error("Error analyzing image:", error);
    return NextResponse.json(
      { error: "Failed to analyze image", details: error.message },
      { status: 500 }
    );
  }
}
