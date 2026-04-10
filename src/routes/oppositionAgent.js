
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
          message: "Please provide a case summary for opposition simulation",
          code: "INVALID_INPUT",
        },
      });
    }

    console.log(`\n⚔️  POST /api/opposition-agent`);
    console.log(`   Case summary length: ${caseSummary.length} chars`);
    console.log(`   Evidence pieces: ${evidence.length}`);
    console.log(`   Laws provided: ${relevantLaws.length}`);

    const evidenceSummary =
      evidence.length > 0
        ? evidence
            .map(
              (e, i) =>
                `${i + 1}. ${e.item || e.name || "Evidence"} [${e.type || "unknown"}] - ${e.strength || "?"} strength: ${e.relevance || e.extractedTextPreview || ""}`
            )
            .join("\n")
        : "No evidence listed";

    const lawsSummary =
      relevantLaws.length > 0
        ? relevantLaws
            .map((l) => `- ${l.act} S.${l.section}: ${l.title || l.applicability || ""}`)
            .join("\n")
        : "No specific laws cited";

    const systemPrompt = `You are a sharp, experienced defense advocate in an Indian court. You have been hired by the OPPOSING side (the accused/defendant) in this case. Your job is to destroy the plaintiff's/complainant's case using every legal argument available.

You are NOT helping the victim - you are the opposition. Find every weakness, every inconsistency, every procedural flaw, every reason why the court should rule against the complainant.

This is a preparation simulation tool to help the complainant understand what they will face in court. Be aggressive and thorough in your opposition.

Tactics you should use:
1. Challenge the admissibility of each piece of evidence
2. Attack the credibility of the complainant
3. Find alternative interpretations of the facts
4. Identify delays and laches (unreasonable delay in filing)
5. Challenge jurisdiction if applicable
6. Find gaps in the chain of evidence
7. Cite procedural defects in how the complaint was made
8. Look for contributory conduct by the complainant
9. Challenge whether the correct law sections were invoked

Respond ONLY with valid JSON.`;

    const userMessage = `You are the opposing advocate. Build the strongest possible counter-case against this complainant:

COMPLAINANT'S CASE SUMMARY:
${caseSummary}

EVIDENCE THE COMPLAINANT IS RELYING ON:
${evidenceSummary}

LAWS THEY ARE INVOKING:
${lawsSummary}

Now DESTROY this case. Build counter-arguments and find every vulnerability.

Respond with this EXACT JSON structure:
{
  "oppositionStrategy": "overall strategy you will use as opposing advocate",
  "counterArguments": [
    {
      "argument": "specific counter-argument",
      "strength": "devastating | strong | moderate | weak",
      "legalBasis": "law or precedent supporting this argument",
      "targetElement": "which part of the complainant's case this attacks"
    }
  ],
  "vulnerabilities": [
    {
      "vulnerability": "specific vulnerability in the complainant's case",
      "howToExploit": "exactly how the opposing lawyer will use this in court",
      "expectedImpact": "how this could change the case outcome"
    }
  ],
  "evidenceChallenges": [
    {
      "evidenceItem": "which piece of evidence you are challenging",
      "challengeType": "authenticity | relevance | admissibility | chain of custody | hearsay",
      "argument": "exact argument to challenge this evidence"
    }
  ],
  "procedualDefects": [
    "any procedural mistakes the complainant made that could get the case dismissed"
  ],
  "suggestedRebuttals": [
    {
      "oppositionArgument": "the attack the opposition will make",
      "rebuttal": "how the complainant SHOULD respond to this attack",
      "supportingEvidence": "what evidence would strengthen the rebuttal"
    }
  ],
  "overallAssessment": "honest assessment of how strong the opposition case is",
  "complainantAdvice": "advice to the complainant on how to survive these attacks"
}`;

    console.log(`\n🤖 Calling api (as opposing advocate)...`);
    const rawResponse = await callapi(systemPrompt, userMessage, 3500);
    const opposition = parseapiJSON(rawResponse);

    console.log(
      `\n✅ /api/opposition-agent complete. ${(opposition.counterArguments || []).length} counter-arguments generated.`
    );

    res.json({
      success: true,
      note: "This is a simulation to help you prepare for opposing arguments. Use these insights to strengthen your case.",
      oppositionStrategy: opposition.oppositionStrategy,
      counterArguments: opposition.counterArguments || [],
      vulnerabilities: opposition.vulnerabilities || [],
      evidenceChallenges: opposition.evidenceChallenges || [],
      proceduralDefects: opposition.procedualDefects || [],
      suggestedRebuttals: opposition.suggestedRebuttals || [],
      overallAssessment: opposition.overallAssessment,
      complainantAdvice: opposition.complainantAdvice,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;