require("dotenv").config({ path: ".env.local" });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // Unfortunately the SDK doesn't have a public listModels. We will just try using "gemini-1.5-pro" or "gemini-1.5-flash"
}
run();
