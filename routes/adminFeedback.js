const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireLogin } = require('../middleware/auth');

// ----- List all feedback entries -----
router.get('/', requireLogin, async (req, res) => {
  try {
    const [feedback] = await pool.query(
      'SELECT * FROM feedback ORDER BY submitted_at DESC'
    );
    res.render('admin/feedback-list', {
      adminUsername: req.session.adminUsername,
      feedback
    });
  } catch (err) {
    console.error('Error loading feedback list:', err);
    res.status(500).send('Error loading feedback list.');
  }
});

// ----- Edit feedback form -----
router.get('/:id/edit', requireLogin, async (req, res) => {
  try {
    const [[entry]] = await pool.query('SELECT * FROM feedback WHERE id = ?', [req.params.id]);
    if (!entry) {
      return res.status(404).send('Feedback entry not found.');
    }
    res.render('admin/feedback-edit', {
      adminUsername: req.session.adminUsername,
      entry,
      error: null
    });
  } catch (err) {
    console.error('Error loading feedback entry:', err);
    res.status(500).send('Error loading feedback entry.');
  }
});

// ----- Handle edit submission -----
router.post('/:id/edit', requireLogin, async (req, res) => {
  const { name, mobile_number, email, amount, bill_number, satisfaction_rating, feedback_text } = req.body;
  const { id } = req.params;

  const errors = [];
  if (!name || name.trim().length < 2) errors.push('Please enter a valid name.');
  if (!/^\d{10}$/.test(mobile_number || '')) errors.push('Mobile number must be exactly 10 digits.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) errors.push('Please enter a valid email address.');
  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) errors.push('Please enter a valid amount.');
  if (!bill_number || bill_number.trim().length === 0) errors.push('Bill number is required.');
  const rating = parseInt(satisfaction_rating, 10);
  if (!rating || rating < 1 || rating > 10) errors.push('Satisfaction rating must be between 1 and 10.');

  if (errors.length > 0) {
    return res.render('admin/feedback-edit', {
      adminUsername: req.session.adminUsername,
      entry: { id, name, mobile_number, email, amount, bill_number, satisfaction_rating, feedback_text },
      error: errors.join(' ')
    });
  }

  try {
    await pool.query(
      `UPDATE feedback SET
        name = ?, mobile_number = ?, email = ?, amount = ?,
        bill_number = ?, satisfaction_rating = ?, feedback_text = ?
       WHERE id = ?`,
      [name.trim(), mobile_number, email.trim(), parseFloat(amount), bill_number.trim(), rating, feedback_text ? feedback_text.trim() : null, id]
    );
    res.redirect('/admin/feedback');
  } catch (err) {
    console.error('Error updating feedback:', err);
    res.render('admin/feedback-edit', {
      adminUsername: req.session.adminUsername,
      entry: req.body,
      error: 'Something went wrong while saving changes.'
    });
  }
});

// ----- Delete feedback entry -----
router.post('/:id/delete', requireLogin, async (req, res) => {
  try {
    await pool.query('DELETE FROM feedback WHERE id = ?', [req.params.id]);
    res.redirect('/admin/feedback');
  } catch (err) {
    console.error('Error deleting feedback:', err);
    res.redirect('/admin/feedback');
  }
});

module.exports = router;
