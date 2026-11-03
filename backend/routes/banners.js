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

    console.log(`Fetching banners for page: ${page}, today: ${today}, currentTime: ${currentTime}`);

    // First, fetch ALL banners to debug
    const allBanners = await db.query('SELECT * FROM banners');
    console.log('All banners in DB:', allBanners.rows.map(b => ({
      id: b.id,
      title: b.title,
      pages: b.pages,
      start_date: b.start_date,
      start_time: b.start_time,
      end_date: b.end_date,
      end_time: b.end_time,
      is_active: b.is_active
    })));

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

    console.log(`Found ${result.rows.length} active banners for page ${page}`);
    result.rows.forEach(b => console.log(`  - ${b.title} (${b.pages.join(', ')})`));

    res.json({ 
      banners: result.rows,
      debug: {
        page,
        today,
        currentTime,
        queriedTime: `${today} ${currentTime}`
      }
    });
  } catch (err) {
    console.error('Error fetching active banners:', err);
    res.status(500).json({ error: 'Failed to fetch active banners' });
  }
});

module.exports = router;
