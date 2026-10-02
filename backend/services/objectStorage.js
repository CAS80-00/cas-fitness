const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * objectStorage
 * Minimal Object Storage abstraction for the carousel ribbon feature.
 *
 * This project doesn't have cloud storage credentials configured (no
 * AWS/S3, Cloudinary, etc. env vars), so files are persisted to local disk
 * under backend/uploads/carousel and served statically at /uploads (see
 * app.js). The upload/delete contract below (uploadImage/deleteImage,
 * returning/accepting a storageKey) is intentionally storage-agnostic so a
 * real cloud provider can be swapped in later by only changing this file —
 * routes/carousel.js never touches the filesystem directly.
 *
 * PostgreSQL (Neon) remains the source of truth for metadata: carousel_cards
 * rows store the public image_url + storage_key returned here.
 */

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads", "carousel");
const PUBLIC_PATH_PREFIX = "/uploads/carousel";

const ALLOWED_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

/**
 * Persists an image buffer to storage.
 * @returns {{ storageKey: string, publicPath: string }}
 */
function uploadImage(buffer, mimeType) {
  ensureUploadDir();
  const extension = ALLOWED_EXTENSIONS[mimeType] || ".jpg";
  const storageKey = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;
  fs.writeFileSync(path.join(UPLOAD_ROOT, storageKey), buffer);
  return { storageKey, publicPath: `${PUBLIC_PATH_PREFIX}/${storageKey}` };
}

/**
 * Purges a previously uploaded image. Safe to call with a missing/null key.
 */
function deleteImage(storageKey) {
  if (!storageKey) return;
  const filePath = path.join(UPLOAD_ROOT, storageKey);
  fs.rm(filePath, { force: true }, (err) => {
    if (err) console.error("objectStorage: failed to purge file", storageKey, err.message);
  });
}

module.exports = { uploadImage, deleteImage, ALLOWED_EXTENSIONS, UPLOAD_ROOT };
