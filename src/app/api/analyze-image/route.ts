import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    let model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      Analyze this image, which is a product label. 
      Extract the list of ingredients and classify the product type.
      Respond ONLY with a valid JSON object using the following structure:
      {
        "productType": "Food" | "Beauty/Cosmetics" | "Supplement" | "Other",
        "ingredients": ["Ingredient 1", "Ingredient 2"]
      }
    `;

    const contents = [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Image,
              mimeType: file.type || "image/jpeg",
            },
          },
        ],
      },
    ] as any;

    const generationConfig = {
      responseMimeType: "application/json",
    };

    let result;
    try {
      result = await model.generateContent({ contents, generationConfig });
    } catch (error: any) {
      const fallbackKey = process.env.GEMINI_API_KEY_FALLBACK;
      const isRateLimit = error?.status === 429 || error?.status === 503 || error?.message?.includes("quota") || error?.message?.includes("429");
      if (isRateLimit && fallbackKey) {
        console.warn("Primary Gemini key limit reached, switching to fallback (gemini-2.5-flash)...");
        const fallbackGenAI = new GoogleGenerativeAI(fallbackKey);
        model = fallbackGenAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        result = await model.generateContent({ contents, generationConfig });
      } else {
        throw error;
      }
    }

    const textResponse = result.response.text();
    let cleanedJson = textResponse;
    
    // Fallback: Remove markdown tags if they are still present
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
      { error: "Failed to analyze image", details: error.message || error.toString() },
      { status: 500 }
    );
  }
}
