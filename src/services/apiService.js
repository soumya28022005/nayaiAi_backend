/**
 * apiService.js (Ollama → Gemini Fallback)
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// ✅ FIXED ENV NAME
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MAX_TOKENS = 4096;

// Gemini fallback models
const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-2.5-pro"
];

// 🧠 MAIN FUNCTION
async function callapi(systemPrompt, userMessage, maxTokens = MAX_TOKENS) {
  console.log(`\n🤖 AI CALL: Ollama → Gemini`);

  // 🟢 1. OLLAMA (LOCAL FIRST 🔥)
  try {
    console.log(`   ♾️ Trying Ollama (LOCAL)...`);

    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral", // ✅ tui already download korechis
        prompt: systemPrompt + "\n" + userMessage,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: maxTokens
        }
      }),
    });

    const data = await res.json();

    if (data.response && data.response.length > 20) {
      console.log(`   ✅ Ollama OK (${data.response.length} chars)`);
      return data.response;
    }

    throw new Error("Empty Ollama response");

  } catch (err) {
    console.warn(`   ⚠️ Ollama failed → ${err.message}`);
    console.log(`   🔄 Switching to Gemini...`);
  }

  // 🟡 2. GEMINI FALLBACK
  let lastError = null;

  for (const modelName of FALLBACK_MODELS) {
    console.log(`   ⏳ Gemini: ${modelName}...`);

    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt
      });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.7
        }
      });

      const text = result.response.text();

      if (text && text.length > 20) {
        console.log(`   ✅ Gemini OK (${text.length} chars)`);
        return text;
      }

    } catch (error) {
      const shortError = error.message.split('\n')[0];
      console.warn(`   ⚠️ ${modelName} failed: ${shortError}`);
      lastError = error;

      if (error.message.includes("403 Forbidden")) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.error("\n❌ ALL AI FAILED");
  throw lastError;
}

// 🧠 JSON PARSER (improved)
function parseapiJSON(text) {
  let cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn("⚠️ JSON parse failed, fixing...");

    try {
      cleaned = cleaned
        .replace(/(\r\n|\n|\r)/gm, "")
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]");

      return JSON.parse(cleaned);
    } catch {
      throw new Error("AI JSON invalid");
    }
  }
}

module.exports = { callapi, parseapiJSON };