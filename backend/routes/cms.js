const express = require("express");
const router = express.Router();
const db = require("../db/client");
const { authenticateToken, requireSuperuser } = require("../middleware/authMiddleware");

function buildSeoPrompt(primaryKeyword, secondaryKeywords, searchIntent) {
  return `Role: Senior SEO Copywriter.
Primary Keyword: ${primaryKeyword}
Secondary Keywords: ${secondaryKeywords.join(", ")}
Search Intent: ${searchIntent}

RULES:
1. Include Primary Keyword in H1 title and within the first 100 words.
2. Distribute secondary keywords naturally across H2/H3 subheadings without stuffing.
3. Use scannable formatting: short paragraphs (max 3-4 sentences), bulleted lists, and bold text.
4. Include 2-3 internal linking placeholders: [Internal Link: 'Anchor Text' -> Route].
5. Hierarchy: Exactly ONE <h1> tag per page. Follow strict H1 -> H2 -> H3 nested order.

CRITICAL FORMATTING INSTRUCTION:
You MUST respond ONLY with a raw, valid JSON object. Do not include markdown code blocks (\`\`\`json), commentary, or intro text.`;
}

// Generate SEO Content via Dynamic Copywriter Logic
router.post("/generate-seo", async (req, res) => {
  const { primaryKeyword, secondaryKeywords = [], searchIntent } = req.body;

  if (typeof primaryKeyword !== "string" || !primaryKeyword.trim() || !Array.isArray(secondaryKeywords)) {
    return res.status(400).json({ error: "A primary keyword is required." });
  }

  try {
    const prompt = buildSeoPrompt(
      primaryKeyword,
      secondaryKeywords,
      searchIntent,
    );

    // Structured JSON Response Simulation / OpenAI Intermediary Integration
    const mockSeoPayload = {
      content_markdown: `# Ultimate Guide to ${primaryKeyword}\n\nAchieve peak performance with custom training regimens designed for maximum efficiency.\n\n## Why Select CAS Fitness?\nOur facilities feature state-of-the-art gear and expert trainers ready to assist your journey. Check out our [Internal Link: 'Membership Plans' -> /plans].`,
      meta_title: `${primaryKeyword} | Transform Your Fitness at CAS Gym`,
      meta_description: `Achieve your personal fitness goals with elite training programs targeting ${primaryKeyword}. Join CAS Fitness today for guided workouts!`,
      slug: primaryKeyword
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, ""),
      schema_type: "LocalBusiness",
    };

    res.json(mockSeoPayload);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to generate SEO automation payload." });
  }
});

router.get("/:pageKey", async (req, res) => {
  try {
    const cmsRes = await db.query(
      "SELECT page_key, content, updated_at FROM cms_content WHERE page_key = $1 LIMIT 1",
      [req.params.pageKey],
    );

    if (cmsRes.rows.length === 0) {
      return res.status(404).json({ error: "CMS page not found." });
    }

    res.json(cmsRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch CMS content." });
  }
});

// Save Page CMS Content
router.post("/save", authenticateToken, requireSuperuser, async (req, res) => {
  const { pageKey, content } = req.body;
  try {
    await db.query(
      `
      INSERT INTO cms_content (page_key, content, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (page_key) DO UPDATE SET content = $2, updated_at = NOW();
    `,
      [pageKey, content],
    );

    res.json({ success: true, message: "Content saved successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to persist CMS content." });
  }
});

module.exports = router;
