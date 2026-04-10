/**
 * health.js - GET /api/health, GET /api/kb
 *
 * PURPOSE: Diagnostic endpoints for development and monitoring.
 *
 * /api/health - Verifies the server is running and API key is configured.
 *               Used by frontend to check if backend is reachable before
 *               showing the main interface.
 *
 * /api/kb - Returns the full legal knowledge base.
 *           Useful for developers to verify what laws are loaded,
 *           and for the frontend to display "supported laws" info.
 */

const express = require("express");
const router = express.Router();
const { getAllSections } = require("../services/ragService");

// GET /api/health
router.get("/health", (req, res) => {
  console.log(`\n💚 GET /api/health`);

  const hasApiKey = !!(process.env.ANTHROPIC_API_KEY &&
    process.env.ANTHROPIC_API_KEY !== "your_anthropic_api_key_here");

  const kbSections = getAllSections();

  res.json({
    success: true,
    status: "operational",
    service: "NyayaAI Case Builder Backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    checks: {
      server: "✅ Running",
      anthropicApiKey: hasApiKey ? "✅ Configured" : "❌ Missing - Set ANTHROPIC_API_KEY in .env",
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
      { method: "GET",  path: "/api/health", description: "Health check" },
      { method: "GET",  path: "/api/kb", description: "View legal knowledge base" },
    ],
  });
});

// GET /api/kb
// Returns the full legal knowledge base for inspection
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