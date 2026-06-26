require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ----- View engine -----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ----- Middleware -----
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 4 } // 4 hours
}));

// ----- Routes -----
app.use('/', require('./routes/public'));
app.use('/admin', require('./routes/adminAuth'));
app.use('/admin', require('./routes/adminDashboard'));
app.use('/admin/feedback', require('./routes/adminFeedback'));
app.use('/admin/reports', require('./routes/adminReports'));
app.use('/admin/users', require('./routes/adminUsers'));
app.use('/admin/settings', require('./routes/adminSettings'));

// ----- 404 handler -----
app.use((req, res) => {
  res.status(404).send('Page not found.');
});

// ----- Start server -----
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Admin login: http://localhost:${PORT}/admin/login`);
});
