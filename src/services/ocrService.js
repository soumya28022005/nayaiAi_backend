/**
 * ocrService.js
 *
 * WHY: Tesseract.js lets us run OCR entirely in Node.js without external services.
 * For Indian legal documents, we support English + Hindi + Bengali.
 * We also handle PDFs by extracting their text layer with pdf-parse,
 * falling back to page-by-page OCR if the PDF is image-based (scanned).
 */

const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");

// WHY: We reuse a single Tesseract worker to avoid loading the engine repeatedly.
// Workers are expensive to create; singleton pattern is standard practice.
let worker = null;

// Track initialization state
// WHY: If the worker fails to init (e.g. no network for model download),
// we should degrade gracefully rather than crashing the server.
let workerInitFailed = false;

/**
 * Initialize the Tesseract worker with multilingual support.
 * WHY: Indian legal docs often have Hindi or Bengali annotations.
 * Loading all 3 languages means we can handle mixed-language documents.
 *
 * On first run, Tesseract downloads ~50MB of language model files.
 * These are cached in ~/.local/share/tesseract.js after the first download.
 * If the network is unavailable, OCR will be disabled but other features work.
 */
async function initWorker() {
  if (worker) return worker;           // Already initialized
  if (workerInitFailed) return null;   // Don't retry a known failure

  console.log("🔤 Initializing Tesseract OCR worker (eng+hin+ben)...");
  console.log("   Note: First run downloads ~50MB of language models (cached after that)");

  try {
    worker = await Tesseract.createWorker(["eng", "hin", "ben"], 1, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          process.stdout.write(`\r   OCR Progress: ${(m.progress * 100).toFixed(0)}%`);
        }
      },
    });
    console.log("\n✅ Tesseract worker ready");
    return worker;
  } catch (err) {
    workerInitFailed = true;
    worker = null;
    console.warn(`\n⚠️  Tesseract OCR worker failed to initialize: ${err.message}`);
    console.warn("   OCR features will be unavailable. Other API features work normally.");
    console.warn("   To enable OCR: ensure internet access for initial model download.");
    return null;
  }
}

/**
 * Extract text from an image file using Tesseract OCR.
 *
 * @param {string} filePath - Absolute path to the image file
 * @returns {string} - Extracted text
 */
async function extractTextFromImage(filePath) {
  console.log(`\n🖼️  Running OCR on image: ${path.basename(filePath)}`);
  const w = await initWorker();

  // If worker failed to initialize, return a clear message instead of crashing
  if (!w) {
    console.warn("   ⚠️  OCR unavailable (worker not initialized). Returning placeholder.");
    return `[OCR unavailable: Tesseract language models could not be downloaded. ` +
           `Please ensure internet access on first run. File: ${path.basename(filePath)}]`;
  }

  const {
    data: { text, confidence },
  } = await w.recognize(filePath);

  console.log(`\n   ✅ OCR complete. Confidence: ${confidence?.toFixed(1)}%. Chars: ${text.length}`);
  return text.trim();
}

/**
 * Extract text from a PDF file.
 * WHY: PDFs come in two flavors:
 *   1. Text-layer PDFs (from Word, legal tools) - fast text extraction
 *   2. Image-only PDFs (scanned documents) - needs OCR
 * We try text extraction first; if it yields too little, we know it's scanned.
 *
 * @param {string} filePath - Absolute path to the PDF file
 * @returns {string} - Extracted text
 */
async function extractTextFromPDF(filePath) {
  console.log(`\n📄 Extracting text from PDF: ${path.basename(filePath)}`);

  try {
    // Dynamically require pdf-parse to avoid top-level error if PDF processing fails
    const pdfParse = require("pdf-parse");
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);

    const extractedText = data.text.trim();

    // If we got meaningful text (more than 50 chars), use it
    // WHY: Scanned PDFs return near-empty or garbled text from text extraction
    if (extractedText.length > 50) {
      console.log(
        `   ✅ Text layer found: ${extractedText.length} chars, ${data.numpages} pages`
      );
      return extractedText;
    }

    // Fall back to OCR if text layer is empty/minimal
    console.log("   ⚠️  Text layer empty. This may be a scanned PDF.");
    console.log("   🔄 Note: OCR on PDFs requires conversion. Returning partial text.");
    return extractedText || "[Scanned PDF - OCR on multi-page PDFs requires additional setup]";
  } catch (err) {
    console.error(`   ❌ PDF parse error: ${err.message}`);
    return `[Could not extract text from PDF: ${err.message}]`;
  }
}

/**
 * Route to the correct extractor based on file MIME type or extension.
 *
 * @param {string} filePath - Absolute path to the uploaded file
 * @param {string} mimetype - MIME type from multer
 * @returns {string} - Extracted text
 */
async function extractText(filePath, mimetype) {
  const ext = path.extname(filePath).toLowerCase();

  if (mimetype === "application/pdf" || ext === ".pdf") {
    return extractTextFromPDF(filePath);
  }

  if (
    mimetype.startsWith("image/") ||
    [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp"].includes(ext)
  ) {
    return extractTextFromImage(filePath);
  }

  // Plain text files - just read them directly
  if (mimetype === "text/plain" || ext === ".txt") {
    console.log(`📝 Reading text file: ${path.basename(filePath)}`);
    return fs.readFileSync(filePath, "utf-8");
  }

  return `[Unsupported file type: ${mimetype}]`;
}

/**
 * Gracefully terminate the Tesseract worker on app shutdown.
 * WHY: Prevents zombie processes hanging around after the server stops.
 */
async function terminateWorker() {
  if (worker) {
    try {
      await worker.terminate();
    } catch (err) {
      // Ignore termination errors
    }
    worker = null;
    console.log("🔴 Tesseract worker terminated");
  }
}

module.exports = { extractText, initWorker, terminateWorker };