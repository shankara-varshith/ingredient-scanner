import { NextRequest, NextResponse } from "next/server";
import { parseOcrText } from "@/utils/ingredientParser";

/**
 * POST /api/analyze-image-ocr
 *
 * Drop-in alternative to /api/analyze-image that uses a local EasyOCR service
 * instead of Gemini.  Accepts the same multipart form (field "image") and
 * returns the same shape: { productType, ingredients[] }.
 *
 * Requires the Python OCR service running at OCR_SERVICE_URL (default localhost:8100).
 */

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || "http://localhost:8100";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Forward the image to the Python OCR service
    const ocrForm = new FormData();
    ocrForm.append("image", file);

    let ocrResponse: Response;
    try {
      ocrResponse = await fetch(`${OCR_SERVICE_URL}/ocr`, {
        method: "POST",
        body: ocrForm,
      });
    } catch (fetchErr: any) {
      console.error("Could not reach OCR service at", OCR_SERVICE_URL, fetchErr.message);
      return NextResponse.json(
        {
          error: "OCR service unavailable",
          details: `Could not connect to ${OCR_SERVICE_URL}. Is the Python OCR service running?`,
        },
        { status: 503 },
      );
    }

    if (!ocrResponse.ok) {
      const errBody = await ocrResponse.text();
      console.error("OCR service error:", ocrResponse.status, errBody);
      return NextResponse.json(
        { error: "OCR extraction failed", details: errBody },
        { status: 502 },
      );
    }

    const ocrData = await ocrResponse.json();
    const rawText: string = ocrData.text || "";

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "No text detected in image. Try a clearer photo of the ingredients label." },
        { status: 422 },
      );
    }

    // Parse the raw OCR text into structured ingredients + product type
    const parsed = parseOcrText(rawText);

    if (parsed.ingredients.length === 0) {
      return NextResponse.json(
        {
          error: "Could not extract ingredients from the detected text.",
          details: `OCR detected: "${rawText.slice(0, 200)}"`,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      productType: parsed.productType,
      ingredients: parsed.ingredients,
      _meta: {
        ocrEngine: "easyocr",
        rawTextLength: rawText.length,
        rawTextPreview: rawText.slice(0, 300),
      },
    });
  } catch (error: any) {
    console.error("Error in analyze-image-ocr:", error);
    return NextResponse.json(
      { error: "Failed to analyze image", details: error.message || error.toString() },
      { status: 500 },
    );
  }
}
