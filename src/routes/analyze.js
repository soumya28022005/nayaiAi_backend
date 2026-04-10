

const express = require("express");
const router = express.Router();
const { callapi, parseapiJSON } = require("../services/apiService");


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

    // Call api api
    const rawResponse = await callapi(systemPrompt, userMessage);

    // Parse the JSON response
    const parsed = parseapiJSON(rawResponse);

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