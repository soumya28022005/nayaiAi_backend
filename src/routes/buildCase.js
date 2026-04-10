/**
 * buildCase.js - POST /api/build-case
 *
 * PURPOSE: Core case-building endpoint. This is the heart of NyayaAI.
 * Takes the analyzed problem + evidence and builds a complete case document.
 *
 * PIPELINE:
 *   [Input] → [RAG: search legal KB] → [Claude: build structured case]
 *   → [Return: summary, timeline, evidence list, relevant laws]
 *
 * WHY RAG HERE: We retrieve relevant IPC/BNS/Consumer Protection sections
 * BEFORE sending to Claude. This grounds Claude's response in actual Indian law
 * and prevents hallucination of fake section numbers (a real LLM problem).
 */

const express = require("express");
const router = express.Router();
const { callClaude, parseClaudeJSON } = require("../services/claudeService");
const { searchLegalKB, formatKBForPrompt } = require("../services/ragService");

router.post("/", async (req, res, next) => {
  try {
    const { problem, entities, evidence = [], language = "en" } = req.body;

    // Input validation
    if (!problem || typeof problem !== "string" || problem.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Please provide a problem description",
          code: "INVALID_INPUT",
        },
      });
    }

    console.log(`\n⚖️  POST /api/build-case`);
    console.log(`   Evidence pieces: ${evidence.length}`);
    console.log(`   Language: ${language}`);
    console.log(`   Has entities: ${!!entities}`);

    // -------------------------------------------------------
    // STEP 1: RAG - Retrieve relevant legal sections
    // WHY: Grounding Claude in actual law prevents hallucination.
    // We search with both the problem text AND any detected domain.
    // -------------------------------------------------------
    const detectedDomain = entities?.legalDomain || "";
    const searchQuery = `${problem} ${detectedDomain}`;

    console.log(`\n🔍 RAG Step: Searching legal knowledge base...`);
    const relevantSections = searchLegalKB(searchQuery, detectedDomain, 6);
    const formattedLaw = formatKBForPrompt(relevantSections);

    console.log(`   📚 Retrieved ${relevantSections.length} relevant law sections`);

    // -------------------------------------------------------
    // STEP 2: Prepare evidence summary for the prompt
    // WHY: Claude works better with a clean structured summary
    // than raw OCR dumps which can be thousands of characters
    // -------------------------------------------------------
    const evidenceSummary =
      evidence.length > 0
        ? evidence
            .map(
              (e, i) =>
                `Evidence ${i + 1} - ${e.name || "Document"}:
  Key Facts: ${Array.isArray(e.keyFacts) ? e.keyFacts.join("; ") : "None extracted"}
  Document Type: ${e.documentType || "Unknown"}
  Parties Mentioned: ${Array.isArray(e.parties) ? e.parties.join(", ") : "None"}
  Amounts: ${Array.isArray(e.amounts) ? e.amounts.join(", ") : "None"}`
            )
            .join("\n\n")
        : "No documentary evidence provided yet.";

    // -------------------------------------------------------
    // STEP 3: Build Case with Claude (using retrieved legal context)
    // -------------------------------------------------------
    const systemPrompt = `You are a senior Indian advocate (lawyer) with 20+ years of experience in trial courts across India. You specialize in building comprehensive legal cases for ordinary citizens who cannot afford legal representation.

You have deep knowledge of:
- Indian Penal Code (IPC) and Bharatiya Nyaya Sanhita (BNS) 2023
- Consumer Protection Act 2019
- RERA (Real Estate Regulation & Development Act 2016)
- RTI Act 2005, Dowry Prohibition Act, Protection of Women from Domestic Violence Act
- Civil Procedure Code and Criminal Procedure Code / BNSS

Your job is to build a clear, structured legal case from the client's problem and evidence.
Use the provided legal sections from the knowledge base to ground your analysis in actual law.

Respond ONLY with valid JSON. No markdown, no explanation.`;

    const userMessage = `Build a complete legal case from the following information:

PROBLEM DESCRIPTION:
${problem}

EXTRACTED ENTITIES:
${entities ? JSON.stringify(entities, null, 2) : "Not yet analyzed"}

EVIDENCE SUMMARY:
${evidenceSummary}

RELEVANT LAW SECTIONS FROM LEGAL KNOWLEDGE BASE:
${formattedLaw}

Build a comprehensive case following this EXACT JSON structure:
{
  "caseSummary": "3-4 paragraph comprehensive summary of the legal case, who the parties are, what happened, what laws were violated",
  "caseTitle": "Professional title for this case e.g. 'Consumer Fraud Case - [Name] vs [Company]'",
  "timeline": [
    {
      "date": "date or approximate timeframe",
      "event": "what happened",
      "legalSignificance": "why this event matters legally",
      "evidenceRef": "which evidence supports this (if any)"
    }
  ],
  "evidenceList": [
    {
      "item": "description of evidence piece",
      "type": "documentary | testimonial | physical | digital",
      "strength": "strong | moderate | weak",
      "relevance": "how this evidence supports the case"
    }
  ],
  "relevantLaws": [
    {
      "act": "name of act",
      "section": "section number",
      "title": "section title",
      "applicability": "why this section applies to this case",
      "reliefAvailable": "what remedy/punishment this section provides"
    }
  ],
  "reliefSought": ["list of specific remedies the victim should ask for"],
  "forumToApproach": "which court/authority to approach (e.g., Consumer Forum, Session Court, High Court)",
  "limitationPeriod": "time limit for filing the case",
  "estimatedStrength": "strong | moderate | weak",
  "caseNotes": "any special considerations, procedural requirements, or important notes for this case"
}`;

    console.log(`\n🤖 Calling Claude to build case...`);
    const rawResponse = await callClaude(systemPrompt, userMessage, 4096);
    const caseData = parseClaudeJSON(rawResponse);

    // Merge the KB sections into the response for completeness
    // WHY: The raw KB objects have more detail than what Claude summarizes
    const relevantLawsFull = relevantSections.map((s) => ({
      act: s.act,
      section: s.section,
      title: s.title,
      description: s.description,
      punishment: s.punishment,
      id: s.id,
    }));

    console.log(`\n✅ /api/build-case complete. Strength: ${caseData.estimatedStrength}`);

    res.json({
      success: true,
      caseSummary: caseData.caseSummary,
      caseTitle: caseData.caseTitle,
      timeline: caseData.timeline || [],
      evidenceList: caseData.evidenceList || [],
      relevantLaws: caseData.relevantLaws || [],
      relevantLawsFull: relevantLawsFull,
      reliefSought: caseData.reliefSought || [],
      forumToApproach: caseData.forumToApproach,
      limitationPeriod: caseData.limitationPeriod,
      estimatedStrength: caseData.estimatedStrength,
      caseNotes: caseData.caseNotes,
      language: language,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;