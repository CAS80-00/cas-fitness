const express = require("express");
const router = express.Router();
const db = require("../db/client");

router.post("/reply", async (req, res) => {
  const messageBody = String(req.body.Body || req.body.body || "").trim().toUpperCase();
  const appointmentId = req.body.appointmentId;

  if (!appointmentId || !messageBody) {
    return res.status(400).json({ error: "appointmentId and message body are required." });
  }

  try {
    if (messageBody === "Y") {
      await db.query(
        "UPDATE consultation_appointments SET status = 'CONFIRMED' WHERE id = $1",
        [appointmentId],
      );
    } else if (messageBody === "N") {
      await db.query(
        `
        UPDATE consultation_appointments
        SET status = 'CANCELED',
            reserved_until = NULL
        WHERE id = $1
      `,
        [appointmentId],
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to process SMS reply webhook." });
  }
});

module.exports = router;
