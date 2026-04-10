/**
 * analyze.js - POST /api/analyze
 *
 * PURPOSE: First step in the NyayaAI pipeline.
 * Takes the user's raw problem description and uses Claude to:
 *   1. Extract named entities (people, dates, amounts, organizations)
 *   2. Identify the legal domain (criminal, consumer, real estate, family, etc.)
 *   3. Generate a plain-language summary of the problem
 *
 * WHY CLAUDE HERE: Entity extraction and domain classification are natural
 * language tasks that require deep understanding of Indian legal context.
 * Claude handles Hindi/Bengali names and Indian currency formats natively.
 */

const express = require("express");
const router = express.Router();
const { callClaude, parseClaudeJSON } = require("../services/claudeService");

// Language labels for the prompt
// WHY: Claude produces better responses when told which language to reply in
const LANGUAGE_MAP = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
};

router.post("/", async (req, res, next) => {
  try {
    const { problem, language = "en" } = req.body;

    // Input validation
    if (!problem || typeof problem !== "string" || problem.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Please provide a problem description of at least 10 characters",
          code: "INVALID_INPUT",
        },
      });
    }

    const langLabel = LANGUAGE_MAP[language] || "English";
    console.log(`\n📋 POST /api/analyze`);
    console.log(`   Language: ${langLabel}`);
    console.log(`   Problem: "${problem.substring(0, 100)}..."`);

    // -------------------------------------------------------
    // System Prompt: Define Claude's role for entity extraction
    // WHY: A focused system prompt produces structured, consistent output.
    // We explicitly ask for JSON so parseClaudeJSON can handle it.
    // -------------------------------------------------------
    const systemPrompt = `You are a senior Indian legal analyst specializing in extracting structured information from legal complaints and problem descriptions. You understand Indian law including IPC, BNS, Consumer Protection Act, RERA, RTI, and family law.

Your job is to analyze a legal problem and extract structured information.

IMPORTANT: Always respond with ONLY valid JSON. No markdown, no explanation, just raw JSON.

The JSON must follow this exact structure:
{
  "entities": {
    "names": ["list of person names mentioned"],
    "dates": ["list of dates in DD-MM-YYYY or descriptive format"],
    "amounts": ["list of monetary amounts with currency e.g. Rs. 50,000"],
    "organizations": ["list of companies, courts, government bodies mentioned"],
    "locations": ["list of places, addresses, cities mentioned"],
    "phoneNumbers": ["list of phone numbers if any"],
    "documentNumbers": ["list of FIR numbers, case numbers, contract numbers"]
  },
  "legalDomain": "one of: criminal | consumer | real_estate | family | cyber | labor | property | rti | other",
  "domainConfidence": "high | medium | low",
  "domainExplanation": "brief explanation of why this domain was chosen",
  "summary": "2-3 sentence plain language summary of the core legal problem",
  "urgency": "immediate | high | medium | low",
  "suggestedActions": ["list of 2-3 immediate practical steps the person should take"],
  "responseLanguage": "${langLabel}"
}`;

    const userMessage = `Analyze this legal problem and extract all relevant information:

PROBLEM DESCRIPTION:
${problem}

Remember: Respond ONLY with valid JSON following the exact structure specified.`;

    // Call Claude API
    const rawResponse = await callClaude(systemPrompt, userMessage);

    // Parse the JSON response
    const parsed = parseClaudeJSON(rawResponse);

    console.log(`   ✅ Analysis complete. Domain: ${parsed.legalDomain}, Urgency: ${parsed.urgency}`);

    res.json({
      success: true,
      entities: parsed.entities,
      legalDomain: parsed.legalDomain,
      domainConfidence: parsed.domainConfidence,
      domainExplanation: parsed.domainExplanation,
      summary: parsed.summary,
      urgency: parsed.urgency,
      suggestedActions: parsed.suggestedActions,
      language: language,
    });
  } catch (err) {
    // Pass to global error handler
    next(err);
  }
});

module.exports = router;