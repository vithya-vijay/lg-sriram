const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { Parser } = require('json2csv');

// Build a WHERE clause + params array from query filters (shared by both
// the on-screen report and the CSV export, so they always stay in sync).
function buildFilterQuery(query) {
  const conditions = [];
  const params = [];

  if (query.from_date) {
    conditions.push('DATE(submitted_at) >= ?');
    params.push(query.from_date);
  }
  if (query.to_date) {
    conditions.push('DATE(submitted_at) <= ?');
    params.push(query.to_date);
  }
  if (query.min_rating) {
    conditions.push('satisfaction_rating >= ?');
    params.push(parseInt(query.min_rating, 10));
  }
  if (query.max_rating) {
    conditions.push('satisfaction_rating <= ?');
    params.push(parseInt(query.max_rating, 10));
  }
  if (query.mobile_number) {
    conditions.push('mobile_number LIKE ?');
    params.push(`%${query.mobile_number}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
}

// ----- Reports page (filters + on-screen table) -----
router.get('/', requireLogin, async (req, res) => {
  try {
    const { whereClause, params } = buildFilterQuery(req.query);

    const [rows] = await pool.query(
      `SELECT * FROM feedback ${whereClause} ORDER BY submitted_at DESC`,
      params
    );

    const [[summary]] = await pool.query(
      `SELECT COUNT(*) AS total, ROUND(AVG(satisfaction_rating), 2) AS avg_rating, SUM(amount) AS total_amount
       FROM feedback ${whereClause}`,
      params
    );

    res.render('admin/reports', {
      adminUsername: req.session.adminUsername,
      rows,
      summary,
      filters: req.query
    });
  } catch (err) {
    console.error('Error loading reports:', err);
    res.status(500).send('Error loading reports.');
  }
});

// ----- CSV export (same filters as the screen view) -----
router.get('/export', requireLogin, async (req, res) => {
  try {
    const { whereClause, params } = buildFilterQuery(req.query);

    const [rows] = await pool.query(
      `SELECT id, name, mobile_number, email, amount, bill_number, satisfaction_rating, feedback_text, submitted_at
       FROM feedback ${whereClause} ORDER BY submitted_at DESC`,
      params
    );

    const fields = [
      { label: 'ID', value: 'id' },
      { label: 'Name', value: 'name' },
      { label: 'Mobile Number', value: 'mobile_number' },
      { label: 'Email', value: 'email' },
      { label: 'Amount', value: 'amount' },
      { label: 'Bill Number', value: 'bill_number' },
      { label: 'Satisfaction Rating', value: 'satisfaction_rating' },
      { label: 'Feedback', value: 'feedback_text' },
      { label: 'Submitted At', value: 'submitted_at' }
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    res.header('Content-Type', 'text/csv');
    res.attachment(`feedback-report-${Date.now()}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Error exporting CSV:', err);
    res.status(500).send('Error exporting CSV.');
  }
});

module.exports = router;
