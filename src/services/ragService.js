/**
 * ragService.js
 *
 * WHY: Implements a lightweight RAG (Retrieval-Augmented Generation) pipeline.
 * For a hackathon, a full vector DB like Chroma adds setup complexity.
 * Instead, we use keyword-based retrieval + api for semantic re-ranking.
 * This gives 80% of the value with 20% of the setup cost.
 *
 * ARCHITECTURE:
 *   1. Load legal-kb.json into memory on startup (fast, data is small)
 *   2. Keyword matching: score each law section against the query
 *   3. Return top-N candidates to the calling route for api to use
 */

const fs = require("fs");
const path = require("path");

// -------------------------------------------------------
// Load the legal knowledge base ONCE at module load time
// WHY: File I/O on every request would be slow; memory is fast
// -------------------------------------------------------
let legalKB = [];

function loadLegalKB() {
  const kbPath = path.join(__dirname, "../../legal-kb.json");
  try {
    const raw = fs.readFileSync(kbPath, "utf-8");
    legalKB = JSON.parse(raw);
    console.log(`📚 Legal Knowledge Base loaded: ${legalKB.length} sections`);
  } catch (err) {
    console.error("❌ Failed to load legal-kb.json:", err.message);
    legalKB = [];
  }
}

// Load immediately when this module is first required
loadLegalKB();

/**
 * Keyword-based relevance scorer.
 * WHY: Without embeddings, keywords are the fastest way to find relevant laws.
 * Each law section has a `keywords` array; we count how many appear in the query.
 * We also boost sections that match the detected legal domain.
 *
 * @param {string} query - The user's problem description or case summary
 * @param {string} domain - Optional detected legal domain (e.g. "consumer", "criminal")
 * @param {number} topN - How many sections to return (default: 5)
 * @returns {Array} - Top N most relevant law sections with their scores
 */
function searchLegalKB(query, domain = "", topN = 5) {
  console.log(`\n🔍 RAG Search - Query: "${query.substring(0, 80)}..."`);
  console.log(`   Domain hint: "${domain}"`);

  const queryLower = query.toLowerCase();
  const domainLower = domain.toLowerCase();

  const scored = legalKB.map((section) => {
    let score = 0;

    // --- Keyword matching (primary signal) ---
    // WHY: Each keyword match strongly indicates relevance
    section.keywords.forEach((kw) => {
      if (queryLower.includes(kw.toLowerCase())) {
        score += 3; // Weighted higher because it's an explicit legal keyword
      }
    });

    // --- Title and description matching (secondary signal) ---
    // WHY: Catches cases where the user uses legal terminology
    const titleWords = section.title.toLowerCase().split(" ");
    titleWords.forEach((word) => {
      if (word.length > 4 && queryLower.includes(word)) {
        score += 1;
      }
    });

    // --- Domain boost ---
    // WHY: If we know the legal domain, sections from that act deserve a boost
    if (domainLower) {
      const actLower = section.act.toLowerCase();
      if (
        actLower.includes(domainLower) ||
        domainLower.includes(actLower) ||
        (domainLower.includes("consumer") && actLower.includes("consumer")) ||
        (domainLower.includes("real estate") && actLower.includes("rera")) ||
        (domainLower.includes("criminal") &&
          (actLower.includes("ipc") || actLower.includes("bns")))
      ) {
        score += 5; // Strong domain match boost
      }
    }

    // --- Section ID direct match ---
    // WHY: If the user mentions "IPC 420" directly, give maximum relevance
    if (queryLower.includes(section.section) || queryLower.includes(section.id.toLowerCase())) {
      score += 10;
    }

    return { ...section, _score: score };
  });

  // Sort by score descending, filter out zero-score items, take topN
  const results = scored
    .filter((s) => s._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, topN);

  // If no results found, return a fallback set of common sections
  // WHY: Better to show something relevant than nothing at all
  if (results.length === 0) {
    console.log("   ⚠️  No keyword matches. Using fallback sections.");
    return legalKB.slice(0, 3);
  }

  console.log(
    `   ✅ Found ${results.length} relevant sections: ${results.map((r) => r.id).join(", ")}`
  );
  return results;
}

/**
 * Format KB results for inclusion in a api prompt.
 * WHY: api understands structured text better than raw JSON arrays.
 * This creates a readable summary of each relevant law.
 *
 * @param {Array} sections - Array of law section objects
 * @returns {string} - Formatted string for injection into api prompts
 */
function formatKBForPrompt(sections) {
  if (!sections || sections.length === 0) {
    return "No specific legal sections found in knowledge base.";
  }

  return sections
    .map(
      (s, i) =>
        `[${i + 1}] ${s.act} Section ${s.section} - "${s.title}"
   Description: ${s.description}
   Punishment: ${s.punishment}
   Applicable to: ${s.keywords.slice(0, 5).join(", ")}`
    )
    .join("\n\n");
}

/**
 * Get all sections from a specific act.
 * WHY: Sometimes we need all RERA or Consumer Protection sections for context.
 */
function getSectionsByAct(actName) {
  return legalKB.filter((s) =>
    s.act.toLowerCase().includes(actName.toLowerCase())
  );
}

/**
 * Get the full KB for inspection (e.g., for health check endpoints).
 */
function getAllSections() {
  return legalKB;
}

module.exports = {
  searchLegalKB,
  formatKBForPrompt,
  getSectionsByAct,
  getAllSections,
};