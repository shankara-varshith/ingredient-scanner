const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const fs = require("fs");

dotenv.config({ path: ".env.local" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function test() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      Analyze this image, which is a product label. 
      Extract the list of ingredients and classify the product type.
      Respond ONLY with a valid JSON object using the following structure:
      {
        "productType": "Food" | "Beauty/Cosmetics" | "Supplement" | "Other",
        "ingredients": ["Ingredient 1", "Ingredient 2"]
      }
    `;

    // Create a 1x1 black pixel base64 image for testing
    const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Image,
                mimeType: "image/png",
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    console.log("Success!");
    console.log(result.response.text());
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
