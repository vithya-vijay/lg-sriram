/**
 * Migration: adds Category (dropdown, admin-managed) and Model (text)
 * to the feedback form.
 *
 * Run this once:
 *   node config/migrate_add_category_model.js
 *
 * Safe to run on an existing database — uses CREATE TABLE IF NOT EXISTS
 * and checks before altering, so it won't error out or duplicate columns
 * if run more than once.
 */

const pool = require('./db');
require('dotenv').config();

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].count > 0;
}

async function migrate() {
  const connection = await pool.getConnection();
  try {
    console.log('Creating "categories" table if it doesn\'t exist...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed a few sensible defaults only if the table is empty
    const [[{ count }]] = await connection.query('SELECT COUNT(*) AS count FROM categories');
    if (count === 0) {
      console.log('Seeding default categories...');
      await connection.query(`
        INSERT INTO categories (name, display_order) VALUES
        ('Electronics', 1),
        ('Appliances', 2),
        ('Mobile & Accessories', 3),
        ('Other', 99)
      `);
    }

    console.log('Checking "feedback" table for category_id column...');
    if (!(await columnExists(connection, 'feedback', 'category_id'))) {
      await connection.query(`
        ALTER TABLE feedback
        ADD COLUMN category_id INT NULL AFTER customer_id,
        ADD CONSTRAINT fk_feedback_category
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      `);
      console.log('✅ Added category_id column + foreign key to feedback.');
    } else {
      console.log('category_id already exists — skipping.');
    }

    console.log('Checking "feedback" table for model column...');
    if (!(await columnExists(connection, 'feedback', 'model'))) {
      await connection.query(`
        ALTER TABLE feedback
        ADD COLUMN model VARCHAR(100) NULL AFTER bill_number
      `);
      console.log('✅ Added model column to feedback.');
    } else {
      console.log('model column already exists — skipping.');
    }

    console.log('✅ Migration complete.');
  } finally {
    connection.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
