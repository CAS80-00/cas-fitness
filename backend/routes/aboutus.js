const express = require("express");
const multer = require("multer");
const router = express.Router();
const db = require("../db/client");
const { authenticateToken, requireSuperuser } = require("../middleware/authMiddleware");
const objectStorage = require("../services/objectStorage");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (!objectStorage.ALLOWED_EXTENSIONS[file.mimetype]) {
      return cb(new Error("Only JPEG, PNG, WEBP, or GIF images are allowed."));
    }
    cb(null, true);
  },
});

const PAGE_KEY = "about-us";
const DEFAULT_CONTENT = {
  mission: "Our mission is to empower every member with personalized coaching, clear goals, and measurable progress in a supportive training community.",
  imageUrl: null,
  storageKey: null,
};

// Public: load about-us content (mission text + image)
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT content, updated_at FROM cms_content WHERE page_key = $1 LIMIT 1",
      [PAGE_KEY]
    );

    if (result.rows.length === 0) {
      return res.json({
        mission: DEFAULT_CONTENT.mission,
        imageUrl: null,
        updatedAt: null,
      });
    }

    const content = result.rows[0].content || DEFAULT_CONTENT;
    res.json({
      mission: content.mission || DEFAULT_CONTENT.mission,
      imageUrl: content.imageUrl || null,
      updatedAt: result.rows[0].updated_at,
    });
  } catch (err) {
    console.error("Failed to load about-us content:", err.message);
    res.status(500).json({ error: "Failed to load about-us content." });
  }
});

// Superuser: update mission text
router.post("/mission", authenticateToken, requireSuperuser, async (req, res) => {
  const mission = typeof req.body.mission === "string" ? req.body.mission.trim() : "";
  if (!mission) {
    return res.status(400).json({ error: "Mission text is required." });
  }

  try {
    // Get existing content (to preserve imageUrl/storageKey)
    const existing = await db.query(
      "SELECT content FROM cms_content WHERE page_key = $1 LIMIT 1",
      [PAGE_KEY]
    );

    const currentContent = existing.rows.length > 0 ? existing.rows[0].content : DEFAULT_CONTENT;
    const updatedContent = {
      ...currentContent,
      mission,
    };

    await db.query(
      `INSERT INTO cms_content (page_key, content, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (page_key)
       DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`,
      [PAGE_KEY, updatedContent]
    );

    res.json({ success: true, mission });
  } catch (err) {
    console.error("Failed to save mission:", err.message);
    res.status(500).json({ error: "Failed to save mission text." });
  }
});

// Superuser: upload/replace image
router.post(
  "/image",
  authenticateToken,
  requireSuperuser,
  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "An image file is required." });
    }

    try {
      // Get existing content to retrieve old storage key
      const existing = await db.query(
        "SELECT content FROM cms_content WHERE page_key = $1 LIMIT 1",
        [PAGE_KEY]
      );

      const currentContent = existing.rows.length > 0 ? existing.rows[0].content : DEFAULT_CONTENT;
      const oldStorageKey = currentContent.storageKey;

      // Upload new image
      const { storageKey, publicPath } = objectStorage.uploadImage(req.file.buffer, req.file.mimetype);
      const imageUrl = `${req.protocol}://${req.get("host")}${publicPath}`;

      // Update database with new image
      const updatedContent = {
        ...currentContent,
        imageUrl,
        storageKey,
      };

      await db.query(
        `INSERT INTO cms_content (page_key, content, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (page_key)
         DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`,
        [PAGE_KEY, updatedContent]
      );

      // Delete old image after new one is safely persisted
      objectStorage.deleteImage(oldStorageKey);

      res.json({
        success: true,
        imageUrl,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to upload image:", err.message);
      res.status(500).json({ error: "Failed to upload image." });
    }
  }
);

// Superuser: delete image (keep mission text)
router.delete("/image", authenticateToken, requireSuperuser, async (req, res) => {
  try {
    // Get existing content
    const existing = await db.query(
      "SELECT content FROM cms_content WHERE page_key = $1 LIMIT 1",
      [PAGE_KEY]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "About-us content not found." });
    }

    const currentContent = existing.rows[0].content || DEFAULT_CONTENT;
    const storageKey = currentContent.storageKey;

    // Update database to remove image
    const updatedContent = {
      ...currentContent,
      imageUrl: null,
      storageKey: null,
    };

    await db.query(
      `UPDATE cms_content
       SET content = $1, updated_at = NOW()
       WHERE page_key = $2`,
      [updatedContent, PAGE_KEY]
    );

    // Delete image file
    objectStorage.deleteImage(storageKey);

    res.json({
      success: true,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Failed to delete image:", err.message);
    res.status(500).json({ error: "Failed to delete image." });
  }
});

module.exports = router;
