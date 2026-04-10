

const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");


let worker = null;


let workerInitFailed = false;


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
    console.warn("   OCR features will be unavailable. Other api features work normally.");
    console.warn("   To enable OCR: ensure internet access for initial model download.");
    return null;
  }
}

/**
 * Etract text from an image file using Tesseract OCR.x
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