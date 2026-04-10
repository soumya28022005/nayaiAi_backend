

const express = require("express");
const router = express.Router();
const { upload, cleanupFiles } = require("../middleware/uploadMiddleware");
const { extractText } = require("../services/ocrService");
const { callapi, parseapiJSON } = require("../services/apiService");

/**
 *
 * @param {string} extractedText - Raw text from OCR
 * @param {string} filename - Original filename (helps api understand context)
 * @returns {Array} - Array of key fact strings
 */
async function extractKeyFacts(extractedText, filename) {
  if (!extractedText || extractedText.length < 20) {
    return ["Could not extract meaningful text from this file"];
  }

  const systemPrompt = `You are a legal document analyst specializing in Indian law. 
Your job is to identify key facts from OCR-extracted text of legal documents.

Respond ONLY with valid JSON in this format:
{
  "keyFacts": [
    "Fact 1: specific, concrete fact found in the document",
    "Fact 2: another specific fact"
  ],
  "documentType": "type of document (e.g., agreement, receipt, FIR, notice, invoice, etc.)",
  "documentDate": "date found in document or null",
  "parties": ["list of people/organizations named in the document"],
  "amounts": ["monetary amounts mentioned"],
  "criticalClauses": ["important clauses or terms if this is a contract/agreement"]
}`;

  const userMessage = `Extract key legal facts from this OCR text of a file named "${filename}":

--- START OF EXTRACTED TEXT ---
${extractedText.substring(0, 3000)} ${extractedText.length > 3000 ? "... [text truncated]" : ""}
--- END OF EXTRACTED TEXT ---

Identify the most legally significant facts. Be specific and factual. Respond ONLY with JSON.`;

  try {
    const response = await callapi(systemPrompt, userMessage, 1500);
    const parsed = parseapiJSON(response);
    return parsed;
  } catch (err) {
    console.warn(`   ⚠️  Key fact extraction failed for ${filename}: ${err.message}`);
    // Return basic structure if api fails - don't let one file break everything
    return {
      keyFacts: ["Text extracted but automatic fact analysis failed"],
      documentType: "Unknown",
      documentDate: null,
      parties: [],
      amounts: [],
      criticalClauses: [],
    };
  }
}

// -------------------------------------------------------
// -------------------------------------------------------
router.post("/", upload.array("files", 10), async (req, res, next) => {
  const uploadedFiles = req.files || [];

  try {
    console.log(`\n📁 POST /api/upload-evidence`);
    console.log(`   Files received: ${uploadedFiles.length}`);

    if (uploadedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: "No files uploaded. Please attach at least one file.",
          code: "NO_FILES",
        },
      });
    }

  
    const results = [];

    for (const file of uploadedFiles) {
      console.log(`\n   📄 Processing: ${file.originalname} (${(file.size / 1024).toFixed(1)} KB)`);

      // Step 1: OCR / text extraction
      const extractedText = await extractText(file.path, file.mimetype);
      console.log(`   📝 Extracted ${extractedText.length} characters`);

      // Step 2: api-powered key fact extraction
      console.log(`   🤖 Analyzing extracted text with api...`);
      const analysis = await extractKeyFacts(extractedText, file.originalname);

      results.push({
        name: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        extractedText: extractedText,
        // Truncate very long text for the response to keep it manageable
        extractedTextPreview: extractedText.substring(0, 500) + (extractedText.length > 500 ? "..." : ""),
        keyFacts: analysis.keyFacts || [],
        documentType: analysis.documentType || "Unknown",
        documentDate: analysis.documentDate || null,
        parties: analysis.parties || [],
        amounts: analysis.amounts || [],
        criticalClauses: analysis.criticalClauses || [],
      });

      console.log(`   ✅ Done: ${file.originalname}`);
    }

    await cleanupFiles(uploadedFiles);

    console.log(`\n✅ /api/upload-evidence complete. Processed ${results.length} files.`);

    res.json({
      success: true,
      filesProcessed: results.length,
      files: results,
    });
  } catch (err) {
    // Attempt cleanup even on error to avoid orphaned files
    await cleanupFiles(uploadedFiles);
    next(err);
  }
});

module.exports = router;