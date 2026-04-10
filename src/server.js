/**
 * server.js - NyayaAI Case Builder Backend
 *
 * Main entry point for the Express application.
 *
 * ARCHITECTURE OVERVIEW:
 * ┌─────────────────────────────────────────────────────┐
 * │                   Express Server                    │
 * │                                                     │
 * │  Middleware Stack:                                  │
 * │  1. dotenv     → Load environment variables         │
 * │  2. cors       → Allow frontend on port 3000        │
 * │  3. json()     → Parse JSON request bodies          │
 * │  4. morgan-like logging (custom)                    │
 * │                                                     │
 * │  Routes:                                            │
 * │  POST /api/analyze         → analyze.js             │
 * │  POST /api/upload-evidence → uploadEvidence.js      │
 * │  POST /api/build-case      → buildCase.js           │
 * │  POST /api/risk-analysis   → riskAnalysis.js        │
 * │  POST /api/opposition-agent→ oppositionAgent.js     │
 * │  POST /api/generate-complaint→generateComplaint.js  │
 * │  GET  /api/health          → health.js              │
 * │  GET  /api/kb              → health.js              │
 * │                                                     │
 * │  Error Handling:                                    │
 * │  notFoundHandler → 404 for unknown routes           │
 * │  errorHandler    → Global error handler             │
 * └─────────────────────────────────────────────────────┘
 */

// -------------------------------------------------------
// Load environment variables FIRST
// WHY: All subsequent code (including imports) may need env vars.
// dotenv.config() must be called before anything else.
// -------------------------------------------------------
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

// -------------------------------------------------------
// Import Route Handlers
// -------------------------------------------------------
const analyzeRoute = require("./routes/analyze");
const uploadEvidenceRoute = require("./routes/uploadEvidence");
const buildCaseRoute = require("./routes/buildCase");
const riskAnalysisRoute = require("./routes/riskAnalysis");
const oppositionAgentRoute = require("./routes/oppositionAgent");
const generateComplaintRoute = require("./routes/generateComplaint");
const healthRoute = require("./routes/health");
const similarCasesRoute = require("./routes/similarCases");

// -------------------------------------------------------
// Import Middleware
// -------------------------------------------------------
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { initWorker } = require("./services/ocrService");

// -------------------------------------------------------
// App Configuration
// -------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// -------------------------------------------------------
// Startup Validation
// WHY: Fail fast if critical environment variables are missing.
// Better to crash on startup than to fail silently mid-request.
// -------------------------------------------------------
function validateEnvironment() {
  console.log("\n🔍 Validating environment...");

  if (!process.env.GEMINI_api_KEY|| process.env.GEMINI_api_KEY === "your_anthropic_api_key_here") {
    console.error("❌ FATAL: ANTHROPIC_api_KEY is not set in .env");
    console.error("   Please copy .env.example to .env and add your api key.");
    process.exit(1);
  }

  console.log("✅ ANTHROPIC_api_KEY: Configured");
  console.log(`✅ PORT: ${PORT}`);
  console.log(`✅ FRONTEND_URL (CORS): ${FRONTEND_URL}`);
  console.log(`✅ NODE_ENV: ${process.env.NODE_ENV || "development"}`);
}

// -------------------------------------------------------
// CORS Configuration
// WHY: The React frontend runs on port 3000 (or Vite's 5173).
// Without CORS headers, browsers will block all api requests
// from the frontend to this backend (same-origin policy).
// -------------------------------------------------------
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      FRONTEND_URL,
      "http://localhost:3000",
      "http://localhost:5173", // Vite dev server
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5173",
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS blocked origin: ${origin}`);
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  optionsSuccessStatus: 200, // For IE11 compatibility
};

// -------------------------------------------------------
// Apply Middleware
// -------------------------------------------------------

// CORS must come first so preflight OPTIONS requests are handled
app.use(cors(corsOptions));

// Parse JSON bodies (needed for all our POST endpoints)
// Limit: 10mb to handle large case summaries with embedded evidence text
app.use(express.json({ limit: "10mb" }));

// Parse URL-encoded bodies (for form submissions)
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// -------------------------------------------------------
// Request Logger
// WHY: Provides visibility into what requests are hitting the server.
// We implement a simple custom logger instead of morgan to avoid
// an extra dependency for the hackathon.
// -------------------------------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  // Log when response finishes (not when request starts)
  // WHY: We can log status code and duration this way
  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusEmoji = res.statusCode < 400 ? "✅" : res.statusCode < 500 ? "⚠️" : "❌";
    console.log(
      `${statusEmoji} [${timestamp}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`
    );
  });

  next();
});

// -------------------------------------------------------
// Mount Routes
// WHY: Each route file handles one cohesive feature.
// The /api prefix keeps all api routes grouped together,
// making it easy to add versioning later (/api/v2/analyze).
// -------------------------------------------------------
app.use("/api", healthRoute);                           // GET /api/health, GET /api/kb
app.use("/api/analyze", analyzeRoute);                  // POST /api/analyze
app.use("/api/upload-evidence", uploadEvidenceRoute); // POST /api/upload-evidence
app.use("/api/build-case", buildCaseRoute);           // POST /api/build-case
app.use("/api/risk-analysis", riskAnalysisRoute);     // POST /api/risk-analysis
app.use("/api/opposition-agent", oppositionAgentRoute); // POST /api/opposition-agent
app.use("/api/generate-complaint", generateComplaintRoute); // POST /api/generate-complaint
app.use("/api/similar-cases", similarCasesRoute);           // POST /api/similar-cases

// Root route - redirect to health check
app.get("/", (req, res) => {
  res.json({
    service: "NyayaAI Case Builder api",
    version: "1.0.0",
    health: "/api/health",
    documentation: "See README.md for api documentation",
  });
});

// -------------------------------------------------------
// Error Handling (must come AFTER all routes)
// WHY: Express identifies error-handling middleware by the
// 4-parameter signature (err, req, res, next).
// Order matters: 404 first, then generic error handler.
// -------------------------------------------------------
app.use(notFoundHandler); // Handle unknown routes → 404
app.use(errorHandler);    // Handle all thrown errors → structured JSON

// -------------------------------------------------------
// Server Startup
// -------------------------------------------------------
async function startServer() {
  validateEnvironment();

  // Ensure uploads directory exists
  const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`📁 Created uploads directory: ${uploadDir}`);
  }

  // Start listening FIRST so the server is immediately responsive
  // WHY: OCR worker initialization can take 3-5 seconds (downloading models).
  // Starting listen() first means the health check and all non-OCR endpoints
  // are available instantly. OCR warms up in the background.
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║            ⚖️  NyayaAI Case Builder Backend               ║
╠═══════════════════════════════════════════════════════════╣
║  Status:   🟢 RUNNING                                     ║
║  Port:     ${PORT}                                           ║
║  api Base: http://localhost:${PORT}/api                      ║
║  Health:   http://localhost:${PORT}/api/health               ║
║  CORS:     ${FRONTEND_URL.padEnd(35)}║
╠═══════════════════════════════════════════════════════════╣
║  Endpoints:                                               ║
║  POST /api/analyze              Entity Extraction         ║
║  POST /api/upload-evidence      OCR & Document Analysis   ║
║  POST /api/build-case           RAG Case Builder          ║
║  POST /api/risk-analysis        Case Risk Analysis        ║
║  POST /api/opposition-agent     Counter-Argument Sim      ║
║  POST /api/generate-complaint   Legal Complaint Draft     ║
║  POST /api/similar-cases        Similar Cases Search      ║
╚═══════════════════════════════════════════════════════════╝
`);

    // Pre-warm OCR in background AFTER the server is already listening
    // WHY: Non-blocking — if it fails, server continues normally without OCR
    console.log("🔤 Pre-warming OCR engine in background...");
    initWorker()
      .then((w) => {
        if (w) console.log("✅ OCR engine ready");
        else console.warn("⚠️  OCR engine unavailable (upload-evidence will return placeholder text)");
      })
      .catch((err) => {
        console.warn(`⚠️  OCR pre-warm error (non-fatal): ${err.message}`);
      });
  });
}

// -------------------------------------------------------
// Graceful Shutdown
// WHY: On Ctrl+C or SIGTERM, terminate the Tesseract worker
// cleanly to avoid orphaned processes.
// -------------------------------------------------------
const { terminateWorker } = require("./services/ocrService");

async function gracefulShutdown(signal) {
  console.log(`\n🔴 ${signal} received. Shutting down gracefully...`);
  await terminateWorker();
  console.log("👋 NyayaAI server stopped.");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// -------------------------------------------------------
// Handle uncaught exceptions to prevent silent crashes
// WHY: Uncaught rejections can crash the server silently.
// We log them and continue running (or exit based on severity).
// -------------------------------------------------------
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  // Tesseract CDN errors are non-fatal — OCR simply won't be available
  const isTesseractNetworkError =
    err.message && (
      err.message.includes("FetchError") ||
      err.message.includes("getaddrinfo") ||
      err.message.includes("cdn.jsdelivr.net") ||
      err.message.includes("traineddata")
    );

  if (isTesseractNetworkError) {
    console.warn("⚠️  Tesseract model download failed (network restricted).");
    console.warn("   OCR features disabled. All other api endpoints are fully operational.");
    return; // Don't exit — server continues running without OCR
  }

  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});

// Start the server
startServer().catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});