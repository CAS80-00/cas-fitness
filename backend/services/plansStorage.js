const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * plansStorage
 * Object Storage for plan photos (reuses the objectStorage pattern from carousel).
 * Files are persisted to local disk under backend/uploads/plans and served
 * statically at /uploads/plans (see app.js).
 */

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads", "plans");
const PUBLIC_PATH_PREFIX = "/uploads/plans";

const ALLOWED_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

/**
 * Persists a plan photo buffer to storage.
 * @returns {{ storageKey: string, publicPath: string }}
 */
function uploadPlanPhoto(buffer, mimeType) {
  ensureUploadDir();
  const extension = ALLOWED_EXTENSIONS[mimeType] || ".jpg";
  const storageKey = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;
  fs.writeFileSync(path.join(UPLOAD_ROOT, storageKey), buffer);
  return { storageKey, publicPath: `${PUBLIC_PATH_PREFIX}/${storageKey}` };
}

/**
 * Purges a previously uploaded plan photo. Safe to call with a missing/null key.
 */
function deletePlanPhoto(storageKey) {
  if (!storageKey) return;
  const filePath = path.join(UPLOAD_ROOT, storageKey);
  fs.rm(filePath, { force: true }, (err) => {
    if (err) console.error("plansStorage: failed to purge file", storageKey, err.message);
  });
}

module.exports = { uploadPlanPhoto, deletePlanPhoto, ALLOWED_EXTENSIONS, UPLOAD_ROOT };
