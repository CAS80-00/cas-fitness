const express = require("express");
const router = express.Router();
const db = require("../db/client");
const { authenticateToken, requireSuperuser } = require("../middleware/authMiddleware");

const PAGE_KEY = "landing-headline";
const DEFAULT_HEADLINE =
  "CAS Fitness, a judgment-free space designed for real people, real goals, and real results. Come and join us.";

// Public: the landing page reads the current headline copy.
router.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT content, updated_at FROM cms_content WHERE page_key = $1 LIMIT 1", [
      PAGE_KEY,
    ]);
    if (result.rows.length === 0) {
      return res.json({ headline: DEFAULT_HEADLINE, updatedAt: null });
    }
    res.json({
      headline: result.rows[0].content?.headline || DEFAULT_HEADLINE,
      updatedAt: result.rows[0].updated_at,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load landing page content." });
  }
});

// Superuser: persist the edited headline.
router.post("/", authenticateToken, requireSuperuser, async (req, res) => {
  const headline = typeof req.body.headline === "string" ? req.body.headline.trim() : "";
  if (!headline) {
    return res.status(400).json({ error: "Headline text is required." });
  }

  try {
    await db.query(
      `INSERT INTO cms_content (page_key, content, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (page_key)
       DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`,
      [PAGE_KEY, { headline }],
    );
    res.json({ success: true, headline });
  } catch (err) {
    res.status(500).json({ error: "Failed to save landing page content." });
  }
});

module.exports = router;
