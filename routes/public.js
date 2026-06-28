const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Helper: load logo + footer links + shop name + categories for every public page
async function getSiteData() {
  const [[settings]] = await pool.query('SELECT * FROM site_settings WHERE id = 1');
  const [footerLinks] = await pool.query(
    'SELECT * FROM footer_links ORDER BY display_order ASC, id ASC'
  );
  const [categories] = await pool.query(
    'SELECT * FROM categories ORDER BY display_order ASC, name ASC'
  );
  return { settings: settings || {}, footerLinks, categories };
}

// ----- Feedback form page -----
router.get('/', async (req, res) => {
  try {
    const { settings, footerLinks, categories } = await getSiteData();
    res.render('form', {
      settings,
      footerLinks,
      categories,
      success: req.query.success,
      error: null,
      existingFeedback: null,
      formData: {}
    });
  } catch (err) {
    console.error('Error loading form page:', err);
    res.status(500).send('Error loading page.');
  }
});

// ----- Mobile number lookup (AJAX) -----
// Called when the user finishes typing a 10-digit mobile number.
// Returns past feedback entries for that number, if any.
router.get('/api/lookup-mobile/:mobile', async (req, res) => {
  const { mobile } = req.params;

  if (!/^\d{10}$/.test(mobile)) {
    return res.status(400).json({ error: 'Invalid mobile number format.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT f.id, f.name, f.email, f.amount, f.bill_number, f.model,
              f.satisfaction_rating, f.feedback_text, f.submitted_at,
              c.name AS category_name
       FROM feedback f
       LEFT JOIN categories c ON c.id = f.category_id
       WHERE f.mobile_number = ?
       ORDER BY f.submitted_at DESC`,
      [mobile]
    );
    res.json({ exists: rows.length > 0, entries: rows });
  } catch (err) {
    console.error('Error looking up mobile number:', err);
    res.status(500).json({ error: 'Lookup failed.' });
  }
});

// ----- Handle feedback submission -----
router.post('/submit', async (req, res) => {
  const { name, mobile_number, email, amount, bill_number, model, category_id, satisfaction_rating, feedback_text } = req.body;

  // Server-side validation (mirrors the client-side checks, never trust the client alone)
  const errors = [];

  if (!name || name.trim().length < 2) {
    errors.push('Please enter a valid name.');
  }
  if (!/^\d{10}$/.test(mobile_number || '')) {
    errors.push('Mobile number must be exactly 10 digits.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) {
    errors.push('Please enter a valid email address.');
  }
  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    errors.push('Please enter a valid purchase amount.');
  }
  if (!bill_number || bill_number.trim().length === 0) {
    errors.push('Bill number is required.');
  }
  if (!category_id) {
    errors.push('Please select a category.');
  }
  const rating = parseInt(satisfaction_rating, 10);
  if (!rating || rating < 1 || rating > 10) {
    errors.push('Satisfaction rating must be between 1 and 10.');
  }

  if (errors.length > 0) {
    try {
      const { settings, footerLinks, categories } = await getSiteData();
      return res.render('form', {
        settings,
        footerLinks,
        categories,
        success: null,
        error: errors.join(' '),
        existingFeedback: null,
        formData: req.body
      });
    } catch (err) {
      return res.status(500).send('Error loading page.');
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Upsert customer record (one row per unique mobile number)
    const [existingCustomer] = await conn.query(
      'SELECT id FROM customers WHERE mobile_number = ?',
      [mobile_number]
    );

    let customerId;
    if (existingCustomer.length > 0) {
      customerId = existingCustomer[0].id;
      await conn.query(
        'UPDATE customers SET name = ?, email = ?, last_seen_at = NOW() WHERE id = ?',
        [name.trim(), email.trim(), customerId]
      );
    } else {
      const [insertResult] = await conn.query(
        'INSERT INTO customers (name, mobile_number, email) VALUES (?, ?, ?)',
        [name.trim(), mobile_number, email.trim()]
      );
      customerId = insertResult.insertId;
    }

    // Insert feedback
    await conn.query(
      `INSERT INTO feedback
        (customer_id, category_id, name, mobile_number, email, amount, bill_number, model, satisfaction_rating, feedback_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        parseInt(category_id, 10),
        name.trim(),
        mobile_number,
        email.trim(),
        parseFloat(amount),
        bill_number.trim(),
        model ? model.trim() : null,
        rating,
        feedback_text ? feedback_text.trim() : null
      ]
    );

    await conn.commit();
    res.redirect('/?success=1');
  } catch (err) {
    await conn.rollback();
    console.error('Error saving feedback:', err);
    try {
      const { settings, footerLinks, categories } = await getSiteData();
      res.render('form', {
        settings,
        footerLinks,
        categories,
        success: null,
        error: 'Something went wrong while saving your feedback. Please try again.',
        existingFeedback: null,
        formData: req.body
      });
    } catch (innerErr) {
      res.status(500).send('Error loading page.');
    }
  } finally {
    conn.release();
  }
});

module.exports = router;
