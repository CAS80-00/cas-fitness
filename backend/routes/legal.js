const express = require("express");
const router = express.Router();
const db = require("../db/client");
const { authenticateToken, requireSuperuser } = require("../middleware/authMiddleware");

router.get("/:pageKey", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT content, updated_at FROM cms_content WHERE page_key = $1 LIMIT 1",
      [req.params.pageKey],
    );
    if (result.rows.length === 0) {
      return res.json({
        pageKey: req.params.pageKey,
        content: { body: "" },
        updated_at: null,
      });
    }
    res.json({ pageKey: req.params.pageKey, ...result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch legal content." });
  }
});

router.post("/:pageKey", authenticateToken, requireSuperuser, async (req, res) => {
  const pageKey = req.params.pageKey;
  const content = req.body.content;

  if (!content || typeof content !== "object") {
    return res.status(400).json({ error: "Content payload is required." });
  }

  try {
    await db.query(
      `
      INSERT INTO cms_content (page_key, content, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (page_key)
      DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
    `,
      [pageKey, content],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save legal content." });
  }
});

module.exports = router;
