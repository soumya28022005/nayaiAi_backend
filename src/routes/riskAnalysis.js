

const express = require("express");
const router = express.Router();
const { callapi, parseapiJSON } = require("../services/apiService");

router.post("/", async (req, res, next) => {
  try {
    const { caseSummary, evidence = [], relevantLaws = [] } = req.body;

    if (!caseSummary || typeof caseSummary !== "string" || caseSummary.trim().length < 20) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Please provide a case summary to analyze",
          code: "INVALID_INPUT",
        },
      });
    }

    console.log(`\n🔍 POST /api/risk-analysis`);
    console.log(`   Case summary length: ${caseSummary.length} chars`);
    console.log(`   Evidence pieces: ${evidence.length}`);
    console.log(`   Laws provided: ${relevantLaws.length}`);

   
    const evidenceSummary =
      evidence.length > 0
        ? evidence
            .map(
              (e, i) =>
                `${i + 1}. ${e.item || e.name || "Evidence"} [${e.type || "unknown type"}] - Strength: ${e.strength || "unknown"}`
            )
            .join("\n")
        : "No documentary evidence provided";

    const lawsSummary =
      relevantLaws.length > 0
        ? relevantLaws
            .map(
              (l) =>
                `- ${l.act} Section ${l.section}: ${l.title || l.applicability || ""}`
            )
            .join("\n")
        : "No laws specified";

    const systemPrompt = `You are a senior Indian advocate reviewing a client's case for risks and weaknesses before going to court. You have 20+ years of courtroom experience and you know exactly what opposing lawyers will attack.

Your job is to be ruthlessly honest about the case's weaknesses. You want to help the client WIN by knowing their vulnerabilities first.

Think like both the client's lawyer AND the opposing lawyer simultaneously.

Consider:
- Evidentiary standards in Indian courts
- Common procedural pitfalls
- What judges typically ask for
- The limitation period and laches issues
- Burden of proof requirements
- Common counterarguments in similar cases

Respond ONLY with valid JSON. Be specific, actionable, and realistic.`;

    const userMessage = `Conduct a thorough risk analysis of this legal case:

CASE SUMMARY:
${caseSummary}

CURRENT EVIDENCE:
${evidenceSummary}

RELEVANT LAWS BEING INVOKED:
${lawsSummary}

Analyze all risks and respond with this EXACT JSON structure:
{
  "overallRiskLevel": "low | medium | high | critical",
  "overallAssessment": "2-3 sentence honest assessment of the case's viability",
  "missingEvidence": [
    {
      "item": "specific evidence that is missing",
      "importance": "critical | important | helpful",
      "howToObtain": "practical steps to get this evidence",
      "deadline": "time-sensitive note if applicable"
    }
  ],
  "weakPoints": [
    {
      "issue": "specific weakness in the current case",
      "severity": "critical | major | minor",
      "explanation": "why this is a problem legally",
      "mitigation": "how to address or minimize this weakness"
    }
  ],
  "challenges": [
    {
      "challenge": "legal or procedural challenge",
      "type": "procedural | evidentiary | legal | jurisdictional | limitation",
      "impact": "how this could affect the case outcome",
      "solution": "recommended approach to overcome this"
    }
  ],
  "strengthsToLeverge": [
    "list of strong points that should be emphasized in court"
  ],
  "urgentActions": [
    {
      "action": "specific action to take immediately",
      "reason": "why this is urgent",
      "timeframe": "within X days/weeks"
    }
  ],
  "probabilityOfSuccess": "percentage estimate e.g. 65%",
  "recommendedStrategy": "overall strategic recommendation for proceeding"
}`;

    console.log(`\n🤖 Calling api for risk analysis...`);
    const rawResponse = await callapi(systemPrompt, userMessage, 3000);
    const analysis = parseapiJSON(rawResponse);

    console.log(
      `\n✅ /api/risk-analysis complete. Risk level: ${analysis.overallRiskLevel}. Success probability: ${analysis.probabilityOfSuccess}`
    );

    res.json({
      success: true,
      overallRiskLevel: analysis.overallRiskLevel,
      overallAssessment: analysis.overallAssessment,
      missingEvidence: analysis.missingEvidence || [],
      weakPoints: analysis.weakPoints || [],
      challenges: analysis.challenges || [],
      strengthsToLeverage: analysis.strengthsToLeverge || [],
      urgentActions: analysis.urgentActions || [],
      probabilityOfSuccess: analysis.probabilityOfSuccess,
      recommendedStrategy: analysis.recommendedStrategy,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;