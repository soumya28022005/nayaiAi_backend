/**
 * errorHandler.js
 *
 * WHY: Centralized error handling prevents duplicate try-catch code in every route.
 * Express's 4-argument middleware signature (err, req, res, next) is the
 * standard way to intercept unhandled errors from any route.
 */

/**
 * Global error-handling middleware.
 * Must have exactly 4 parameters for Express to treat it as error middleware.
 */
function errorHandler(err, req, res, next) {
  // Log the full error server-side so developers can debug
  console.error("\n❌ Unhandled Error:");
  console.error(`   Route: ${req.method} ${req.originalUrl}`);
  console.error(`   Message: ${err.message}`);
  if (process.env.NODE_ENV === "development") {
    console.error(`   Stack: ${err.stack}`);
  }

  // Determine HTTP status code
  // WHY: Map common error types to appropriate HTTP codes
  let status = err.status || err.statusCode || 500;

  // Anthropic API errors often have a status property
  if (err.message && err.message.includes("API key")) {
    status = 401;
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    status = 413; // Payload Too Large
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    status = 400; // Bad Request
  }

  // Send structured error response to client
  res.status(status).json({
    success: false,
    error: {
      message: err.message || "An unexpected error occurred",
      code: err.code || "INTERNAL_ERROR",
      // Only expose stack trace in development
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  });
}

/**
 * 404 handler for undefined routes.
 * WHY: Gives a clear JSON response when frontend hits a non-existent endpoint
 * instead of Express's default HTML 404 page.
 */
function notFoundHandler(req, res) {
  console.warn(`⚠️  404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      code: "NOT_FOUND",
      availableRoutes: [
        "POST /api/analyze",
        "POST /api/upload-evidence",
        "POST /api/build-case",
        "POST /api/risk-analysis",
        "POST /api/opposition-agent",
        "POST /api/generate-complaint",
        "GET  /api/health",
        "GET  /api/kb",
      ],
    },
  });
}

module.exports = { errorHandler, notFoundHandler };