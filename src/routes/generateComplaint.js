/**
 * generateComplaint.js - POST /api/generate-complaint
 *
 * PURPOSE: The final step in the pipeline - generating a professionally
 * formatted legal complaint document ready to submit to court.
 *
 * WHY THIS IS VALUABLE: Most Indian citizens cannot afford lawyers to
 * draft complaints. A poorly drafted complaint can get dismissed on
 * technical grounds. This generates a court-ready document in proper
 * Indian legal format.
 *
 * OUTPUT FORMAT: The complaint follows the standard Indian legal format:
 *   - Heading (Court name, parties)
 *   - Background facts
 *   - Cause of action
 *   - Legal grounds
 *   - Prayer (relief sought)
 *   - Verification
 */

const express = require("express");
const router = express.Router();
const { callClaude, parseClaudeJSON } = require("../services/claudeService");

router.post("/", async (req, res, next) => {
  try {
    const {
      caseSummary,
      timeline = [],
      evidence = [],
      relevantLaws = [],
      riskAnalysis = null,
      language = "en",
    } = req.body;

    if (!caseSummary || typeof caseSummary !== "string" || caseSummary.trim().length < 20) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Please provide a case summary to generate the complaint",
          code: "INVALID_INPUT",
        },
      });
    }

    console.log(`\n📝 POST /api/generate-complaint`);
    console.log(`   Case summary length: ${caseSummary.length} chars`);
    console.log(`   Timeline events: ${timeline.length}`);
    console.log(`   Evidence pieces: ${evidence.length}`);
    console.log(`   Laws: ${relevantLaws.length}`);
    console.log(`   Has risk analysis: ${!!riskAnalysis}`);
    console.log(`   Language: ${language}`);

    // -------------------------------------------------------
    // Prepare condensed context for the prompt
    // WHY: Generating a complaint requires ALL the context,
    // but we need to be selective about how much raw text we send
    // to avoid hitting token limits.
    // -------------------------------------------------------

    const timelineSummary = timeline
      .map((t) => `- ${t.date}: ${t.event} [${t.legalSignificance || "relevant event"}]`)
      .join("\n");

    const evidenceSummary = evidence
      .map((e, i) => `${i + 1}. ${e.item || e.name} (${e.type || "document"}) - ${e.relevance || e.strength || ""}`)
      .join("\n");

    const lawsSummary = relevantLaws
      .map((l) => `- ${l.act} Section ${l.section} "${l.title || ""}" - ${l.applicability || l.reliefAvailable || ""}`)
      .join("\n");

    const riskNotes = riskAnalysis
      ? `\nRisk Analysis Insights (incorporate to strengthen the complaint):
- Overall Risk: ${riskAnalysis.overallRiskLevel || "not assessed"}
- Key Weaknesses to Address: ${(riskAnalysis.weakPoints || []).slice(0, 3).map((w) => w.issue || w).join("; ")}
- Missing Evidence Noted: ${(riskAnalysis.missingEvidence || []).slice(0, 2).map((m) => m.item || m).join("; ")}`
      : "";

    const languageInstruction =
      language === "hi"
        ? "Draft the complaint primarily in Hindi (Devanagari script), with legal terms in English where standard practice."
        : language === "bn"
        ? "Draft the complaint primarily in Bengali (Bangla script), with legal terms in English where standard practice."
        : "Draft the complaint in English, using formal Indian legal language.";

    // -------------------------------------------------------
    // System Prompt: Claude as expert legal drafter
    // WHY: Drafting legal complaints requires precise language.
    // We're asking for BOTH the full complaint text AND a
    // structured sections breakdown so the frontend can
    // highlight different parts of the document.
    // -------------------------------------------------------
    const systemPrompt = `You are a senior advocate with 25 years of experience drafting legal complaints for Indian courts. You have drafted hundreds of successful complaints for consumer forums, civil courts, criminal courts, and quasi-judicial bodies.

Your complaint drafts are known for:
- Precise, formal legal language
- Clear chronological narration of facts
- Proper citation of applicable law sections
- Comprehensive prayer clauses
- Correct format as per Indian court standards

${languageInstruction}

Respond ONLY with valid JSON. The "complaint" field must contain the complete formatted complaint as a single string with proper line breaks (\\n).`;

    const userMessage = `Generate a complete, court-ready legal complaint based on:

CASE SUMMARY:
${caseSummary}

TIMELINE OF EVENTS:
${timelineSummary || "No specific timeline provided"}

DOCUMENTARY EVIDENCE:
${evidenceSummary || "No documentary evidence listed"}

APPLICABLE LAW SECTIONS:
${lawsSummary || "No specific sections cited"}
${riskNotes}

Generate the complete legal complaint following this JSON structure:
{
  "complaint": "COMPLETE FORMATTED COMPLAINT TEXT HERE with proper legal formatting, paragraphs, and sections. Use \\n for line breaks. This should be the actual document ready to print and submit.",
  "sections": [
    {
      "sectionName": "name of section (e.g., Background, Cause of Action, Prayer)",
      "content": "text of this section",
      "claim": "the legal claim this section establishes",
      "evidenceRef": "which evidence number(s) support this section"
    }
  ],
  "documentMetadata": {
    "recommendedCourt": "which court/forum to file this in",
    "filingFee": "estimated filing fee range",
    "documentsToAttach": ["list of documents to attach with this complaint"],
    "numberOfCopies": "how many copies to submit",
    "whoShouldSign": "who needs to sign and verify this complaint"
  },
  "nextSteps": [
    "step 1: what to do after drafting",
    "step 2: where to go",
    "step 3: what to carry"
  ]
}

The complaint must include ALL standard sections:
1. Court heading (To, The [Court Name])
2. Parties section (Complainant vs Opponent)
3. Brief Facts / Background
4. Cause of Action
5. Legal Grounds (citing specific sections)
6. Relief Sought / Prayer Clause
7. Verification (signature block)`;

    console.log(`\n🤖 Calling Claude to generate legal complaint...`);
    const rawResponse = await callClaude(systemPrompt, userMessage, 4096);
    const result = parseClaudeJSON(rawResponse);

    // Validate that we got actual complaint text
    if (!result.complaint || result.complaint.length < 100) {
      throw new Error("Claude generated an incomplete complaint. Please try again.");
    }

    console.log(
      `\n✅ /api/generate-complaint complete. Complaint length: ${result.complaint.length} chars. Sections: ${(result.sections || []).length}`
    );

    res.json({
      success: true,
      complaint: result.complaint,
      sections: result.sections || [],
      documentMetadata: result.documentMetadata || {},
      nextSteps: result.nextSteps || [],
      language: language,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;