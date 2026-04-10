

const express = require("express");
const router = express.Router();
const { getAllSections } = require("../services/ragService");

// GET /api/health
router.get("/health", (req, res) => {
  console.log(`\n💚 GET /api/health`);

  // Explicitly map to the global process object to avoid shadowing or transpilation errors
  const env = global.process.env;

  const hasapiKey = !!(env.GEMINI_api_KEY &&
    env.GEMINI_api_KEY !== "your_gemini_api_key_here");

  const kbSections = getAllSections();

  res.json({
    success: true,
    status: "operational",
    service: "NyayaAI Case Builder Backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV || "development",
    checks: {
      server: "✅ Running",
      geminiapiKey: hasapiKey ? "✅ Configured" : "❌ Missing - Set GEMINI_api_KEY in .env",
      legalKnowledgeBase: `✅ ${kbSections.length} sections loaded`,
      uploadsDirectory: "✅ Ready",
    },
    endpoints: [
      { method: "POST", path: "/api/analyze", description: "Extract entities and detect legal domain" },
      { method: "POST", path: "/api/upload-evidence", description: "Upload and OCR documents" },
      { method: "POST", path: "/api/build-case", description: "Build complete case with RAG" },
      { method: "POST", path: "/api/risk-analysis", description: "Identify case weaknesses" },
      { method: "POST", path: "/api/opposition-agent", description: "Simulate opposing lawyer" },
      { method: "POST", path: "/api/generate-complaint", description: "Generate legal complaint" },
      { method: "POST", path: "/api/similar-cases", description: "Find similar cases" },
      { method: "GET",  path: "/api/health", description: "Health check" },
      { method: "GET",  path: "/api/kb", description: "View legal knowledge base" },
    ],
  });
});


router.get("/kb", (req, res) => {
  console.log(`\n📚 GET /api/kb`);
  const sections = getAllSections();

  // Group by act for easier browsing
  const grouped = sections.reduce((acc, section) => {
    if (!acc[section.act]) acc[section.act] = [];
    acc[section.act].push({
      id: section.id,
      section: section.section,
      title: section.title,
      keywords: section.keywords,
      punishment: section.punishment,
    });
    return acc;
  }, {});

  res.json({
    success: true,
    totalSections: sections.length,
    acts: Object.keys(grouped),
    byAct: grouped,
    allSections: sections,
  });
});

module.exports = router;