const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { Parser } = require('json2csv');

// Build a WHERE clause + params array from query filters (shared by both
// the on-screen report and the CSV export, so they always stay in sync).
// Columns are qualified with f. since both queries JOIN against categories.
function buildFilterQuery(query) {
  const conditions = [];
  const params = [];

  if (query.from_date) {
    conditions.push('DATE(f.submitted_at) >= ?');
    params.push(query.from_date);
  }
  if (query.to_date) {
    conditions.push('DATE(f.submitted_at) <= ?');
    params.push(query.to_date);
  }
  if (query.min_rating) {
    conditions.push('f.satisfaction_rating >= ?');
    params.push(parseInt(query.min_rating, 10));
  }
  if (query.max_rating) {
    conditions.push('f.satisfaction_rating <= ?');
    params.push(parseInt(query.max_rating, 10));
  }
  if (query.mobile_number) {
    conditions.push('f.mobile_number LIKE ?');
    params.push(`%${query.mobile_number}%`);
  }
  if (query.category_id) {
    conditions.push('f.category_id = ?');
    params.push(parseInt(query.category_id, 10));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
}

// ----- Reports page (filters + on-screen table) -----
router.get('/', requireLogin, async (req, res) => {
  try {
    const { whereClause, params } = buildFilterQuery(req.query);

    const [rows] = await pool.query(
      `SELECT f.*, c.name AS category_name
       FROM feedback f
       LEFT JOIN categories c ON c.id = f.category_id
       ${whereClause} ORDER BY f.submitted_at DESC`,
      params
    );

    const [[summary]] = await pool.query(
      `SELECT COUNT(*) AS total, ROUND(AVG(f.satisfaction_rating), 2) AS avg_rating, SUM(f.amount) AS total_amount
       FROM feedback f ${whereClause}`,
      params
    );

    const [categories] = await pool.query('SELECT * FROM categories ORDER BY display_order ASC, name ASC');

    res.render('admin/reports', {
      adminUsername: req.session.adminUsername,
      rows,
      summary,
      categories,
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
      `SELECT f.id, f.name, f.mobile_number, f.email, c.name AS category_name, f.model,
              f.amount, f.bill_number, f.satisfaction_rating, f.feedback_text, f.submitted_at
       FROM feedback f
       LEFT JOIN categories c ON c.id = f.category_id
       ${whereClause} ORDER BY f.submitted_at DESC`,
      params
    );

    const fields = [
      { label: 'ID', value: 'id' },
      { label: 'Name', value: 'name' },
      { label: 'Mobile Number', value: 'mobile_number' },
      { label: 'Email', value: 'email' },
      { label: 'Category', value: 'category_name' },
      { label: 'Model', value: 'model' },
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
