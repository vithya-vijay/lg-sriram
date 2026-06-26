const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireLogin } = require('../middleware/auth');

router.get('/dashboard', requireLogin, async (req, res) => {
  try {
    // Feedback count today
    const [[todayRow]] = await pool.query(
      `SELECT COUNT(*) AS count FROM feedback WHERE DATE(submitted_at) = CURDATE()`
    );

    // Feedback count this month
    const [[monthRow]] = await pool.query(
      `SELECT COUNT(*) AS count FROM feedback
       WHERE YEAR(submitted_at) = YEAR(CURDATE()) AND MONTH(submitted_at) = MONTH(CURDATE())`
    );

    // Total unique customers
    const [[customersRow]] = await pool.query(`SELECT COUNT(*) AS count FROM customers`);

    // Overall average review score (out of 10)
    const [[avgRow]] = await pool.query(
      `SELECT ROUND(AVG(satisfaction_rating), 2) AS avg_rating, COUNT(*) AS total FROM feedback`
    );

    // Recent feedback (latest 5, for a quick preview on the dashboard)
    const [recentFeedback] = await pool.query(
      `SELECT id, name, mobile_number, satisfaction_rating, submitted_at
       FROM feedback ORDER BY submitted_at DESC LIMIT 5`
    );

    res.render('admin/dashboard', {
      adminUsername: req.session.adminUsername,
      stats: {
        today: todayRow.count,
        month: monthRow.count,
        totalCustomers: customersRow.count,
        avgRating: avgRow.avg_rating || 0,
        totalFeedback: avgRow.total || 0
      },
      recentFeedback
    });
  } catch (err) {
    console.error('Error loading dashboard:', err);
    res.status(500).send('Error loading dashboard.');
  }
});

// ----- Chart data API endpoints -----

router.get('/api/submissions-over-time', requireLogin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DATE(submitted_at) AS day, COUNT(*) AS count
      FROM feedback
      WHERE submitted_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(submitted_at)
      ORDER BY day ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching submissions-over-time:', err);
    res.status(500).json({ error: 'Failed to load chart data.' });
  }
});

router.get('/api/rating-breakdown', requireLogin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT satisfaction_rating AS rating, COUNT(*) AS count
      FROM feedback
      GROUP BY satisfaction_rating
      ORDER BY satisfaction_rating ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching rating-breakdown:', err);
    res.status(500).json({ error: 'Failed to load chart data.' });
  }
});

module.exports = router;
