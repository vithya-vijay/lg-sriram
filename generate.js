// Generates realistic-looking seed data for testing:
// 100 customers + 100 matching feedback rows, properly linked by customer_id.

const firstNames = ['Raj', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anita', 'Suresh', 'Kavya', 'Arjun', 'Deepa',
  'Karthik', 'Meena', 'Sanjay', 'Pooja', 'Ravi', 'Divya', 'Manoj', 'Lakshmi', 'Vijay', 'Swathi'];
const lastNames = ['Kumar', 'Sharma', 'Reddy', 'Patel', 'Singh', 'Iyer', 'Nair', 'Rao', 'Gupta', 'Menon'];

const billPrefixes = ['BILL', 'INV', 'RCPT'];
const feedbackSamples = [
  'Great service, very happy with the purchase.',
  'Staff was helpful and friendly.',
  'Product quality could be better.',
  'Quick checkout, no waiting time.',
  'Excellent experience overall.',
  'Average experience, nothing special.',
  'Loved the variety of products available.',
  'Delivery was on time.',
  'Will definitely shop here again.',
  'Customer support resolved my issue quickly.',
  null, // some entries have no written feedback
  null
];

function pad(num, size) {
  return num.toString().padStart(size, '0');
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomMobile(index) {
  // Generate unique 10-digit Indian-style mobile numbers starting with 9, 8, 7, or 6
  const prefix = randomChoice(['9', '8', '7', '6']);
  const rest = pad(7000000 + index * 37 + Math.floor(Math.random() * 1000), 9);
  return prefix + rest;
}

function randomDateWithinLastNDays(days) {
  const now = new Date();
  const past = new Date(now.getTime() - Math.random() * days * 24 * 60 * 60 * 1000);
  return past.toISOString().slice(0, 19).replace('T', ' ');
}

function escapeSql(value) {
  if (value === null) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

const customerRows = [];
const feedbackRows = [];

for (let i = 1; i <= 100; i++) {
  const firstName = randomChoice(firstNames);
  const lastName = randomChoice(lastNames);
  const fullName = `${firstName} ${lastName}`;
  const mobile = randomMobile(i);
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;

  const firstSeen = randomDateWithinLastNDays(90);
  const lastSeen = randomDateWithinLastNDays(10);

  customerRows.push(
    `(${i}, ${escapeSql(fullName)}, ${escapeSql(mobile)}, ${escapeSql(email)}, ${escapeSql(firstSeen)}, ${escapeSql(lastSeen)})`
  );

  const amount = (Math.random() * 9500 + 500).toFixed(2);
  const billNumber = `${randomChoice(billPrefixes)}-${pad(1000 + i, 4)}`;
  const rating = Math.floor(Math.random() * 10) + 1;
  const feedbackText = randomChoice(feedbackSamples);
  const submittedAt = randomDateWithinLastNDays(30);

  feedbackRows.push(
    `(${i}, ${i}, ${escapeSql(fullName)}, ${escapeSql(mobile)}, ${escapeSql(email)}, ${amount}, ${escapeSql(billNumber)}, ${rating}, ${escapeSql(feedbackText)}, ${escapeSql(submittedAt)})`
  );
}

const customersSql =
  'INSERT INTO `lg_sriram`.`customers` (`id`, `name`, `mobile_number`, `email`, `first_seen_at`, `last_seen_at`) VALUES\n' +
  customerRows.join(',\n') + ';\n';

const feedbackSql =
  'INSERT INTO `lg_sriram`.`feedback` (`id`, `customer_id`, `name`, `mobile_number`, `email`, `amount`, `bill_number`, `satisfaction_rating`, `feedback_text`, `submitted_at`) VALUES\n' +
  feedbackRows.join(',\n') + ';\n';

const fs = require('fs');
fs.writeFileSync('C:/projects/lg-sriram/seed_customers_and_feedback.sql',
  '-- Seed data: 100 customers + 100 matching feedback entries\n' +
  '-- Run customers INSERT first, then feedback INSERT (feedback.customer_id depends on customers.id)\n\n' +
  '-- ===== CUSTOMERS =====\n' + customersSql +
  '\n-- ===== FEEDBACK =====\n' + feedbackSql
);

console.log('✅ Generated seed_customers_and_feedback.sql with 100 customers + 100 feedback rows.');