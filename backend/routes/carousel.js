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

function toCardResponse(row) {
  return {
    id: row.id,
    position: row.position,
    imageUrl: row.image_url,
    updatedAt: row.updated_at,
  };
}

// Public: the landing page ribbon (and the Superuser management grid) both
// read the full card list, including empty slots.
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, position, image_url, updated_at FROM carousel_cards ORDER BY position ASC, id ASC",
    );
    res.json({ cards: result.rows.map(toCardResponse) });
  } catch (err) {
    res.status(500).json({ error: "Failed to load carousel cards." });
  }
});

// Superuser: add a new empty card slot.
router.post("/cards", authenticateToken, requireSuperuser, async (req, res) => {
  try {
    const maxRes = await db.query("SELECT COALESCE(MAX(position), 0) AS max_position FROM carousel_cards");
    const nextPosition = Number(maxRes.rows[0].max_position) + 1;
    const insertRes = await db.query(
      `INSERT INTO carousel_cards (position, image_url, storage_key)
       VALUES ($1, NULL, NULL)
       RETURNING id, position, image_url, updated_at`,
      [nextPosition],
    );
    res.status(201).json({ card: toCardResponse(insertRes.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: "Failed to add a new card slot." });
  }
});

// Superuser: remove a card slot entirely (purges its image if present).
router.delete("/cards/:id", authenticateToken, requireSuperuser, async (req, res) => {
  try {
    const existing = await db.query("SELECT storage_key FROM carousel_cards WHERE id = $1", [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Card slot not found." });
    }
    await db.query("DELETE FROM carousel_cards WHERE id = $1", [req.params.id]);
    objectStorage.deleteImage(existing.rows[0].storage_key);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove card slot." });
  }
});

// Superuser: upload/replace the image for an existing card slot.
router.post(
  "/cards/:id/image",
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
      const existing = await db.query("SELECT storage_key FROM carousel_cards WHERE id = $1", [
        req.params.id,
      ]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Card slot not found." });
      }

      const { storageKey, publicPath } = objectStorage.uploadImage(req.file.buffer, req.file.mimetype);
      const imageUrl = `${req.protocol}://${req.get("host")}${publicPath}`;

      const updateRes = await db.query(
        `UPDATE carousel_cards
         SET image_url = $1, storage_key = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id, position, image_url, updated_at`,
        [imageUrl, storageKey, req.params.id],
      );

      // Purge the previous file only after the new one is safely persisted.
      objectStorage.deleteImage(existing.rows[0].storage_key);

      res.json({ card: toCardResponse(updateRes.rows[0]) });
    } catch (err) {
      res.status(500).json({ error: "Failed to upload image." });
    }
  },
);

// Superuser: delete the image from a card without removing the slot.
router.delete("/cards/:id/image", authenticateToken, requireSuperuser, async (req, res) => {
  try {
    const existing = await db.query("SELECT storage_key FROM carousel_cards WHERE id = $1", [
      req.params.id,
    ]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Card slot not found." });
    }

    const updateRes = await db.query(
      `UPDATE carousel_cards
       SET image_url = NULL, storage_key = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING id, position, image_url, updated_at`,
      [req.params.id],
    );

    objectStorage.deleteImage(existing.rows[0].storage_key);
    res.json({ card: toCardResponse(updateRes.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete image." });
  }
});

module.exports = router;
