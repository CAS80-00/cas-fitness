const express = require("express");
const router = express.Router();
const db = require("../db/client");
const { authenticateToken, requireSuperuser } = require("../middleware/authMiddleware");

// Public: basic plan catalog (id/title/price) for the Plans page and the
// Superuser's Promocodes "Applies To" dropdown.
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, title, description, price, billing_cycle, photo_url, display_order, details FROM plans ORDER BY display_order ASC, id ASC",
    );
    res.json({
      plans: result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        price: Number(row.price),
        billingCycle: row.billing_cycle,
        photo_url: row.photo_url,
        displayOrder: row.display_order,
        details: row.details || "",
      })),
    });
  } catch (err) {
    console.error("Error loading plans:", err.message, err.stack);
    res.status(500).json({ error: "Failed to load plans: " + err.message });
  }
});

// Superuser: reorder plans
router.post("/reorder", authenticateToken, requireSuperuser, async (req, res) => {
  const { planOrder } = req.body; // Array of { id, displayOrder }

  if (!Array.isArray(planOrder) || planOrder.length === 0) {
    return res.status(400).json({ error: "Valid plan order array is required." });
  }

  try {
    // Update all plans with their new display_order
    for (const item of planOrder) {
      await db.query(
        "UPDATE plans SET display_order = $1, updated_at = NOW() WHERE id = $2",
        [item.displayOrder, item.id]
      );
    }

    res.json({ success: true, message: "Plans reordered successfully." });
  } catch (err) {
    console.error("Error reordering plans:", err.message);
    res.status(500).json({ error: "Failed to reorder plans: " + err.message });
  }
});

// Superuser: update plan details (title, description, price, billing_cycle)
router.put("/:id", authenticateToken, requireSuperuser, async (req, res) => {
  const { id } = req.params;
  const { title, description, price, billing_cycle } = req.body;

  // Validation
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Plan title is required." });
  }
  if (!description || !description.trim()) {
    return res.status(400).json({ error: "Plan description is required." });
  }
  if (price === undefined || price === null) {
    return res.status(400).json({ error: "Price is required." });
  }
  if (Number(price) < 0) {
    return res.status(400).json({ error: "Price must be non-negative." });
  }
  if (!billing_cycle || !billing_cycle.trim()) {
    return res.status(400).json({ error: "Billing cycle is required." });
  }

  try {
    const result = await db.query(
      `UPDATE plans 
       SET title = $1, description = $2, price = $3, billing_cycle = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, title, description, price, billing_cycle, photo_url, display_order`,
      [title.trim(), description.trim(), Number(price), billing_cycle.trim(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Plan not found." });
    }

    const updatedPlan = result.rows[0];
    res.json({
      success: true,
      message: "Plan updated successfully.",
      plan: {
        id: updatedPlan.id,
        title: updatedPlan.title,
        description: updatedPlan.description,
        price: Number(updatedPlan.price),
        billingCycle: updatedPlan.billing_cycle,
        photo_url: updatedPlan.photo_url,
        displayOrder: updatedPlan.display_order,
      },
    });
  } catch (err) {
    console.error("Error updating plan:", err.message);
    res.status(500).json({ error: "Failed to update plan: " + err.message });
  }
});

// Superuser: update plan details (the expanded details text)
router.put("/:id/details", authenticateToken, requireSuperuser, async (req, res) => {
  const { id } = req.params;
  const { details } = req.body;

  try {
    const result = await db.query(
      "UPDATE plans SET details = $1, updated_at = NOW() WHERE id = $2 RETURNING id, details",
      [details || "", id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Plan not found." });
    }

    res.json({
      success: true,
      message: "Plan details updated successfully.",
      details: result.rows[0].details,
    });
  } catch (err) {
    console.error("Error updating plan details:", err.message);
    res.status(500).json({ error: "Failed to update plan details: " + err.message });
  }
});

module.exports = router;
