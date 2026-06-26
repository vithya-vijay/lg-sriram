/**
 * Run this once before starting the app:
 *   npm run init-db
 *
 * Creates the `lg_sriram` database, all required tables, a default admin
 * account, and a default site_settings row (so the app has something to
 * render before the admin uploads a logo / adds footer links).
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function initDb() {
  const dbName = process.env.DB_NAME || 'llg_sriram';

  // Step 1: connect WITHOUT specifying a database, so we can create it
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123'
  });

  console.log(`Creating database \`${dbName}\` if it doesn't exist...`);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await connection.query(`USE \`${dbName}\``);

  // ---------------------------------------------------------------
  // admins — admin login accounts
  // ---------------------------------------------------------------
  console.log('Creating "admins" table...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ---------------------------------------------------------------
  // customers — one row per unique mobile number, so we can look up
  // "have they given feedback before" quickly and show a customer list
  // ---------------------------------------------------------------
  console.log('Creating "customers" table...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      mobile_number VARCHAR(15) NOT NULL UNIQUE,
      email VARCHAR(150),
      first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ---------------------------------------------------------------
  // feedback — one row per submission
  // ---------------------------------------------------------------
  console.log('Creating "feedback" table...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT,
      name VARCHAR(100) NOT NULL,
      mobile_number VARCHAR(15) NOT NULL,
      email VARCHAR(150) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      bill_number VARCHAR(50) NOT NULL,
      satisfaction_rating TINYINT NOT NULL CHECK (satisfaction_rating BETWEEN 1 AND 10),
      feedback_text TEXT,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      INDEX idx_mobile (mobile_number),
      INDEX idx_submitted_at (submitted_at)
    )
  `);

  // ---------------------------------------------------------------
  // footer_links — admin-managed footer links for the frontend
  // ---------------------------------------------------------------
  console.log('Creating "footer_links" table...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS footer_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      label VARCHAR(100) NOT NULL,
      url VARCHAR(255) NOT NULL,
      display_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ---------------------------------------------------------------
  // site_settings — single-row table holding the logo path + shop name
  // ---------------------------------------------------------------
  console.log('Creating "site_settings" table...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id INT PRIMARY KEY DEFAULT 1,
      shop_name VARCHAR(150) DEFAULT 'Our Shop',
      logo_path VARCHAR(255) DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const [settingsRows] = await connection.query('SELECT COUNT(*) AS count FROM site_settings');
  if (settingsRows[0].count === 0) {
    await connection.query(
      'INSERT INTO site_settings (id, shop_name, logo_path) VALUES (1, ?, NULL)',
      ['Our Shop']
    );
    console.log('✅ Default site_settings row created.');
  }

  // ---------------------------------------------------------------
  // Default admin account
  // ---------------------------------------------------------------
  const [admins] = await connection.query('SELECT COUNT(*) AS count FROM admins');
  if (admins[0].count === 0) {
    const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(defaultPassword, 10);

    await connection.query(
      'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
      [defaultUsername, hash]
    );

    console.log(`✅ Default admin created — username: "${defaultUsername}", password: "${defaultPassword}"`);
    console.log('   (Change this password after logging in for the first time!)');
  } else {
    console.log('Admin account already exists — skipping default admin creation.');
  }

  console.log('✅ Database setup complete.');
  await connection.end();
}

initDb().catch(err => {
  console.error('❌ Database setup failed:', err.message);
  process.exit(1);
});
