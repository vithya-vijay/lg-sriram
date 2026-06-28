const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { requireLogin } = require('../middleware/auth');

// ----- Multer config for logo uploads -----
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'logo');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPG, JPEG, SVG, or WEBP files are allowed.'));
    }
  }
});

// ----- Settings page (logo + footer links + categories management) -----
router.get('/', requireLogin, async (req, res) => {
  try {
    const [[settings]] = await pool.query('SELECT * FROM site_settings WHERE id = 1');
    const [footerLinks] = await pool.query(
      'SELECT * FROM footer_links ORDER BY display_order ASC, id ASC'
    );
    const [categories] = await pool.query(
      'SELECT * FROM categories ORDER BY display_order ASC, name ASC'
    );

    res.render('admin/settings', {
      adminUsername: req.session.adminUsername,
      settings: settings || {},
      footerLinks,
      categories,
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (err) {
    console.error('Error loading settings page:', err);
    res.status(500).send('Error loading settings page.');
  }
});

// ----- Update shop name + upload logo -----
router.post('/logo', requireLogin, (req, res) => {
  upload.single('logo')(req, res, async (err) => {
    if (err) {
      return res.redirect(`/admin/settings?error=${encodeURIComponent(err.message)}`);
    }

    try {
      const { shop_name } = req.body;
      const [[existing]] = await pool.query('SELECT logo_path FROM site_settings WHERE id = 1');

      let logoPath = existing ? existing.logo_path : null;

      if (req.file) {
        // Remove old logo file if one exists, to avoid orphaned uploads piling up
        if (logoPath) {
          const oldFilePath = path.join(__dirname, '..', 'public', logoPath);
          fs.unlink(oldFilePath, () => {}); // ignore errors (file may not exist)
        }
        logoPath = `/uploads/logo/${req.file.filename}`;
      }

      await pool.query(
        'UPDATE site_settings SET shop_name = ?, logo_path = ? WHERE id = 1',
        [shop_name ? shop_name.trim() : 'Our Shop', logoPath]
      );

      res.redirect('/admin/settings?success=Logo+and+shop+name+updated');
    } catch (dbErr) {
      console.error('Error updating logo/shop name:', dbErr);
      res.redirect('/admin/settings?error=Something+went+wrong');
    }
  });
});

// ----- Add a footer link -----
router.post('/footer-links/add', requireLogin, async (req, res) => {
  const { label, url, display_order } = req.body;

  if (!label || !url) {
    return res.redirect('/admin/settings?error=Label+and+URL+are+required');
  }

  try {
    await pool.query(
      'INSERT INTO footer_links (label, url, display_order) VALUES (?, ?, ?)',
      [label.trim(), url.trim(), parseInt(display_order, 10) || 0]
    );
    res.redirect('/admin/settings?success=Footer+link+added');
  } catch (err) {
    console.error('Error adding footer link:', err);
    res.redirect('/admin/settings?error=Something+went+wrong');
  }
});

// ----- Delete a footer link -----
router.post('/footer-links/:id/delete', requireLogin, async (req, res) => {
  try {
    await pool.query('DELETE FROM footer_links WHERE id = ?', [req.params.id]);
    res.redirect('/admin/settings?success=Footer+link+removed');
  } catch (err) {
    console.error('Error deleting footer link:', err);
    res.redirect('/admin/settings?error=Something+went+wrong');
  }
});

// ----- Add a category -----
router.post('/categories/add', requireLogin, async (req, res) => {
  const { name, display_order } = req.body;

  if (!name || name.trim().length === 0) {
    return res.redirect('/admin/settings?error=Category+name+is+required');
  }

  try {
    await pool.query(
      'INSERT INTO categories (name, display_order) VALUES (?, ?)',
      [name.trim(), parseInt(display_order, 10) || 0]
    );
    res.redirect('/admin/settings?success=Category+added');
  } catch (err) {
    console.error('Error adding category:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.redirect('/admin/settings?error=That+category+already+exists');
    }
    res.redirect('/admin/settings?error=Something+went+wrong');
  }
});

// ----- Delete a category -----
// Existing feedback rows that reference this category keep their data —
// the foreign key is ON DELETE SET NULL, so their category_id just becomes
// NULL rather than the delete being blocked or the feedback being removed.
router.post('/categories/:id/delete', requireLogin, async (req, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.redirect('/admin/settings?success=Category+removed');
  } catch (err) {
    console.error('Error deleting category:', err);
    res.redirect('/admin/settings?error=Something+went+wrong');
  }
});

module.exports = router;
