/**
 * uploadMiddleware.js
 *
 * WHY: Multer handles multipart/form-data (file uploads) in Express.
 * We configure it here with:
 *   - Disk storage (saves to /uploads folder)
 *   - File type whitelist (security: only accept images and PDFs)
 *   - File size limits (prevent abuse)
 *   - Unique filename generation (prevent filename collisions)
 */

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

// Ensure the uploads directory exists
// WHY: If uploads/ doesn't exist, multer will throw on first upload
const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`📁 Created uploads directory: ${uploadDir}`);
}

// -------------------------------------------------------
// Storage Engine
// WHY: diskStorage gives us control over where/how files are saved.
// memoryStorage would work too but risks RAM exhaustion on large files.
// -------------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    // Use UUID prefix to prevent filename collisions from concurrent uploads
    // WHY: Two users uploading "document.pdf" at the same time would overwrite each other
    const uniquePrefix = uuidv4().substring(0, 8);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${uniquePrefix}-${safeName}`);
  },
});

// -------------------------------------------------------
// File Type Filter (Whitelist Approach)
// WHY: Whitelisting is safer than blacklisting.
// We only accept formats Tesseract.js and pdf-parse can handle.
// -------------------------------------------------------
const allowedMimeTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/webp",
  "application/pdf",
  "text/plain",
];

function fileFilter(req, file, cb) {
  if (allowedMimeTypes.includes(file.mimetype)) {
    console.log(`   ✅ File accepted: ${file.originalname} (${file.mimetype})`);
    cb(null, true);
  } else {
    console.warn(`   ❌ File rejected: ${file.originalname} (${file.mimetype})`);
    cb(
      new Error(
        `File type not supported: ${file.mimetype}. Allowed types: images (JPG, PNG, GIF, BMP, TIFF, WEBP) and PDF.`
      ),
      false
    );
  }
}

// -------------------------------------------------------
// Multer Instance
// -------------------------------------------------------
const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || "10", 10);

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSizeMB * 1024 * 1024, // Convert MB to bytes
    files: 10, // Max 10 files per request
  },
});

/**
 * Cleanup uploaded files after they've been processed.
 * WHY: We shouldn't store user documents longer than necessary.
 * This is especially important for sensitive legal documents.
 *
 * @param {Array} files - Array of multer file objects
 */
async function cleanupFiles(files) {
  if (!files || files.length === 0) return;

  files.forEach((file) => {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        console.log(`   🗑️  Cleaned up: ${file.filename}`);
      }
    } catch (err) {
      console.warn(`   ⚠️  Could not delete file ${file.path}: ${err.message}`);
    }
  });
}

module.exports = { upload, cleanupFiles };