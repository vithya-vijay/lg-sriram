const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requireLogin } = require('../middleware/auth');

// ----- Users page: admins tab (default) or customers tab -----
router.get('/', requireLogin, async (req, res) => {
  const tab = req.query.tab === 'customers' ? 'customers' : 'admins';

  try {
    const [admins] = await pool.query(
      'SELECT id, username, created_at FROM admins ORDER BY created_at ASC'
    );

    const [customers] = await pool.query(`
      SELECT c.*, COUNT(f.id) AS feedback_count
      FROM customers c
      LEFT JOIN feedback f ON f.customer_id = c.id
      GROUP BY c.id
      ORDER BY c.last_seen_at DESC
    `);

    res.render('admin/users', {
      adminUsername: req.session.adminUsername,
      currentAdminId: req.session.adminId,
      tab,
      admins,
      customers,
      error: null
    });
  } catch (err) {
    console.error('Error loading users page:', err);
    res.status(500).send('Error loading users page.');
  }
});

// ----- Add a new admin -----
router.post('/admins/add', requireLogin, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password || password.length < 6) {
    return res.redirect('/admin/users?tab=admins&error=Username+required+and+password+must+be+6%2B+characters');
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [username.trim(), hash]);
    res.redirect('/admin/users?tab=admins');
  } catch (err) {
    console.error('Error adding admin:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.redirect('/admin/users?tab=admins&error=That+username+already+exists');
    }
    res.redirect('/admin/users?tab=admins&error=Something+went+wrong');
  }
});

// ----- Delete an admin (can't delete yourself or the last remaining admin) -----
router.post('/admins/:id/delete', requireLogin, async (req, res) => {
  const { id } = req.params;

  try {
    if (parseInt(id, 10) === req.session.adminId) {
      return res.redirect('/admin/users?tab=admins&error=You+cannot+delete+your+own+account+while+logged+in');
    }

    const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM admins');
    if (count <= 1) {
      return res.redirect('/admin/users?tab=admins&error=Cannot+delete+the+last+remaining+admin');
    }

    await pool.query('DELETE FROM admins WHERE id = ?', [id]);
    res.redirect('/admin/users?tab=admins');
  } catch (err) {
    console.error('Error deleting admin:', err);
    res.redirect('/admin/users?tab=admins&error=Something+went+wrong');
  }
});

module.exports = router;
