const express = require('express');
const router = express.Router();
const db = require('../db/client');

// GET active banners for a specific page (public endpoint)
router.get('/active/:page', async (req, res) => {
  try {
    const { page } = req.params;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0];

    const result = await db.query(
      `SELECT id, title, content, background_color, text_color, start_date, end_date, pages
       FROM banners 
       WHERE is_active = TRUE
       AND pages @> $1
       AND (DATE(start_date) < $2 OR (DATE(start_date) = $2 AND start_time <= $3))
       AND (DATE(end_date) > $2 OR (DATE(end_date) = $2 AND end_time >= $3))
       ORDER BY created_at ASC`,
      [JSON.stringify([page]), today, currentTime]
    );

    res.json({ banners: result.rows });
  } catch (err) {
    console.error('Error fetching active banners:', err);
    res.status(500).json({ error: 'Failed to fetch active banners' });
  }
});

module.exports = router;

