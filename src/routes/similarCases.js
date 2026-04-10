/**
 * similarCases.js - POST /api/similar-cases
 *
 * PURPOSE: Finds similar historical cases, their typical outcomes, 
 * calculates the win probability, and estimates costs for individuals 
 * fighting without a lawyer (Pro Se / Party-in-Person) vs with a lawyer.
 * * Completely isolated route to avoid breaking existing features.
 */

const express = require("express");
const router = express.Router();
const { callClaude, parseClaudeJSON } = require("../services/claudeService");

router.post("/", async (req, res, next) => {
  try {
    const { caseSummary, domain = "General Law" } = req.body;

    // 1. Input Validation
    if (!caseSummary || typeof caseSummary !== "string" || caseSummary.trim().length < 20) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Please provide a valid case summary to find similar cases.",
          code: "INVALID_INPUT",
        },
      });
    }

    console.log(`\n📊 POST /api/similar-cases`);
    console.log(`   Searching precedents for domain: ${domain}`);

    // 2. System Prompt
    const systemPrompt = `You are an expert Indian Legal Data Analyst and Researcher. 
Your job is to analyze the provided case summary and estimate historical data regarding similar cases in Indian Courts (like Consumer Forums, RERA, High Courts, etc.).

You must provide realistic estimations based on typical Indian legal outcomes. Specifically, you need to provide:
1. Similar types of cases and their usual outcomes.
2. The estimated win percentage if the victim fights WITHOUT a lawyer (Party-in-Person).
3. The estimated win percentage if the victim fights WITH a lawyer.
4. The estimated financial costs for both scenarios.

Respond ONLY with valid JSON. Do not include markdown formatting like \`\`\`json.`;

    // 3. User Message Prompt with Cost Estimation format
    const userMessage = `Analyze this case and provide historical precedent data:

CASE SUMMARY:
${caseSummary}

LEGAL DOMAIN:
${domain}

Respond with this EXACT JSON structure:
{
  "estimatedSimilarCasesPerYear": "e.g., 10,000+",
  "typicalCaseDuration": "e.g., 1.5 to 3 years",
  "withoutLawyerWinPercentage": "e.g., 40%",
  "withLawyerWinPercentage": "e.g., 75%",
  "estimatedCostWithLawyer": "e.g., ₹50,000 - ₹1,50,000 (Lawyer fees + court fees)",
  "estimatedCostWithoutLawyer": "e.g., ₹2,000 - ₹5,000 (Only court fees, printing, travel)",
  "historicalPrecedents": [
    {
      "caseType": "Brief name/type of similar case",
      "typicalOutcome": "What usually happens (e.g., Refund with 9% interest)",
      "keyWinningFactor": "What makes the victim win this type of case"
    }
  ],
  "proSeAdvice": "2-3 sentences of specific advice for fighting this exact case WITHOUT a lawyer (Party-in-Person)."
}`;

    console.log(`\n🤖 Calling Claude for similar cases analysis...`);
    
    // 4. API Call to Claude
    const rawResponse = await callClaude(systemPrompt, userMessage, 2000);
    const analysis = parseClaudeJSON(rawResponse);

    console.log(`✅ /api/similar-cases complete. Without Lawyer Win Rate: ${analysis.withoutLawyerWinPercentage}`);

    // 5. Send Response to Frontend
    res.json({
      success: true,
      data: analysis
    });

  } catch (err) {
    console.error("❌ Error in similarCases route:", err);
    next(err);
  }
});

module.exports = router;