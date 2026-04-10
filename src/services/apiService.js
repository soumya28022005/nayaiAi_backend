/**
 * apiService.js (Gemini Waterfall Fallback Version)
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(global.process.env.GEMINI_api_KEY);
const MAX_TOKENS = 4096;

// A prioritized list of models. The script will try them in order.
// If one is overloaded (503) or deprecated (404), it seamlessly moves to the next.
const FALLBACK_MODELS = [
  "gemini-2.5-flash",       // Try the newest fast model first
  "gemini-2.0-flash",       // Fallback to the previous stable fast model
  "gemini-flash-latest",    // Fallback to Google's auto-routing alias
  "gemini-2.5-pro"          // Final fallback to the heavy-duty model
];

async function callapi(systemPrompt, userMessage, maxTokens = MAX_TOKENS) {
  console.log(`\n🤖 Calling Gemini api (Waterfall Mode)...`);
  let lastError = null;

  // Loop through our model list until one works
  for (const modelName of FALLBACK_MODELS) {
    console.log(`   ⏳ Attempting connection to: ${modelName}...`);
    
    try {
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemPrompt
      });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: maxTokens }
      });

      const text = result.response.text();
      console.log(`   ✅ Success using ${modelName}! Responded: ${text.length} chars`);
      return text;

    } catch (error) {
      // Extract just the first line of the error so the terminal stays clean
      const shortError = error.message.split('\n')[0];
      console.warn(`   ⚠️ ${modelName} rejected the request: ${shortError}`);
      lastError = error;

      // If the error is a 403 Forbidden (api key issue), stop entirely.
      // Changing the model won't fix a bad api key.
      if (error.message.includes("403 Forbidden")) {
         throw error; 
      }

      // Wait 1 second before trying the next model to avoid triggering rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // If the loop finishes and all models failed, throw the final error to the Express handler
  console.error("\n❌ CRITICAL: All Gemini fallback models failed.");
  throw lastError;
}

function parseapiJSON(text) {
  let cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("❌ Failed to parse AI JSON:", cleaned.substring(0, 200));
    throw new Error(`AI returned invalid JSON: ${err.message}`);
  }
}

module.exports = { callapi, parseapiJSON };