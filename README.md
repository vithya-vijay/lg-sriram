# LG Sriram — Customer Feedback System

A full customer feedback platform backed by **MySQL** (`lg-sriram` database),
with a complete admin panel: dashboard with stats, feedback management,
filterable reports with CSV export, admin/customer user management, and a
CMS-style logo + footer link manager for the public-facing form.

## Features

### Customer-facing feedback form
- Fields: Name, Mobile Number (numeric-only, 10-digit validated), Email
  (validated), Purchase Amount, Bill Number, Satisfaction Rating (1–10),
  Feedback text
- **Live mobile number lookup** — if the customer enters a mobile number
  that already has feedback on file, their past submissions show up in a
  table right on the form (read-only, informational)
- Logo and footer links are pulled live from the database — no code change
  needed to update branding
- Client-side + server-side validation (never trust the client alone)

### Admin panel
- **Login** — bcrypt-hashed passwords, session-based auth
- **Dashboard** — feedback count today, feedback count this month, total
  unique customers, overall average review score, plus two charts
  (submissions over time, rating breakdown) and a recent-feedback preview
- **Feedback Entries** — full list with **Edit** and **Delete** actions
- **Reports** — filter by date range, rating range, or mobile number; view
  summary stats (count, average rating, total amount); **export filtered
  results to CSV**
- **Users** — two tabs:
  - *Admins*: add/remove admin accounts (can't delete yourself or the last
    remaining admin)
  - *Customers*: view every unique customer, with their feedback count and
    first/last seen dates
- **Logo & Footer settings** — upload a shop logo (PNG/JPG/SVG/WEBP, 2MB
  max), set the shop name, and add/remove footer links — all reflected
  immediately on the public form

## Prerequisites
- **Node.js** v16+
- **MySQL Server** running locally or remotely

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure your database connection
```bash
copy .env.example .env        # Windows
cp .env.example .env          # Mac/Linux
```

Edit `.env` with your real MySQL credentials:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_actual_mysql_password
DB_NAME=lg-sriram
```

### 3. Initialize the database
This creates the `lg-sriram` database, every table, a default
`site_settings` row, and a default admin account:
```bash
npm run init-db
```

Expected output:
```
Creating database `lg-sriram` if it doesn't exist...
Creating "admins" table...
Creating "customers" table...
Creating "feedback" table...
Creating "footer_links" table...
Creating "site_settings" table...
✅ Default site_settings row created.
✅ Default admin created — username: "admin", password: "admin123"
✅ Database setup complete.
```

### 4. Start the app
```bash
npm start
```

### 5. Open in your browser
- Feedback form: http://localhost:3000
- Admin login: http://localhost:3000/admin/login (default: `admin` / `admin123`)

**Change the default admin password** after your first login — go to
Users → Admins, add a new admin with a strong password, log in as that
admin, then delete the default `admin` account.

## Project Structure
```
lg-sriram/
├── server.js                          # Wires together all routes
├── package.json
├── .env.example                       # Copy to .env and fill in DB credentials
├── config/
│   ├── db.js                          # MySQL connection pool
│   └── initDb.js                      # One-time DB/table/admin setup script
├── middleware/
│   └── auth.js                        # requireLogin guard for admin routes
├── routes/
│   ├── public.js                      # Feedback form, submission, mobile lookup API
│   ├── adminAuth.js                   # Admin login/logout
│   ├── adminDashboard.js              # Dashboard stats + chart data API
│   ├── adminFeedback.js               # Feedback list, edit, delete
│   ├── adminReports.js                # Filtered reports + CSV export
│   ├── adminUsers.js                  # Admin accounts + customer list
│   └── adminSettings.js               # Logo upload + footer links
├── views/
│   ├── form.ejs                       # Public feedback form
│   ├── partials/
│   │   └── admin-nav.ejs              # Shared admin sidebar
│   └── admin/
│       ├── login.ejs
│       ├── dashboard.ejs
│       ├── feedback-list.ejs
│       ├── feedback-edit.ejs
│       ├── reports.ejs
│       ├── users.ejs
│       └── settings.ejs
└── public/
    ├── css/
    │   ├── style.css                   # Public form styling
    │   └── admin.css                   # Admin panel styling (sidebar layout)
    ├── js/
    │   └── form-validation.js          # Client-side validation + mobile lookup
    └── uploads/logo/                   # Uploaded logo files land here
```

## Database Schema (`lg-sriram`)

**admins**
| Column         | Type         |
|----------------|--------------|
| id             | INT (PK)     |
| username       | VARCHAR(50) UNIQUE |
| password_hash  | VARCHAR(255) |
| created_at     | TIMESTAMP    |

**customers** — one row per unique mobile number
| Column         | Type         |
|----------------|--------------|
| id             | INT (PK)     |
| name           | VARCHAR(100) |
| mobile_number  | VARCHAR(15) UNIQUE |
| email          | VARCHAR(150) |
| first_seen_at  | TIMESTAMP    |
| last_seen_at   | TIMESTAMP    |

**feedback**
| Column               | Type            |
|----------------------|-----------------|
| id                   | INT (PK)        |
| customer_id          | INT (FK → customers.id) |
| name                 | VARCHAR(100)    |
| mobile_number        | VARCHAR(15)     |
| email                | VARCHAR(150)    |
| amount               | DECIMAL(10,2)   |
| bill_number          | VARCHAR(50)     |
| satisfaction_rating  | TINYINT (1-10)  |
| feedback_text        | TEXT            |
| submitted_at         | TIMESTAMP       |

**footer_links**
| Column         | Type         |
|----------------|--------------|
| id             | INT (PK)     |
| label          | VARCHAR(100) |
| url            | VARCHAR(255) |
| display_order  | INT          |
| created_at     | TIMESTAMP    |

**site_settings** — single-row table (id always = 1)
| Column      | Type          |
|-------------|---------------|
| id          | INT (PK)      |
| shop_name   | VARCHAR(150)  |
| logo_path   | VARCHAR(255)  |
| updated_at  | TIMESTAMP     |

## Notes & Possible Next Steps
- **Security**: admin passwords are hashed with bcrypt; no plaintext storage.
  Consider adding rate-limiting on the login route and CSRF protection
  (e.g. `csurf`) before exposing this to the public internet.
- **Logo uploads**: stored on local disk under `public/uploads/logo/`. If
  you deploy to a host with an ephemeral filesystem (e.g. some PaaS
  platforms), switch to a cloud storage bucket (S3, Cloudinary, etc.)
  instead — local files won't survive a redeploy there.
- **Reports**: CSV export currently includes raw feedback rows. Ask if you
  want an Excel (.xlsx) export instead, or a date-grouped summary report.

## Troubleshooting

**"Cannot find module 'express'" or similar**
→ Run `npm install` in the project folder first.

**"ER_ACCESS_DENIED_ERROR" or "ECONNREFUSED"**
→ Check `.env` — wrong `DB_USER`/`DB_PASSWORD`, or MySQL isn't running.

**Logo upload fails silently / file too big**
→ Max upload size is 2MB. Resize the image or increase the limit in
`routes/adminSettings.js` (`limits: { fileSize: ... }`).

**Mobile lookup table never appears on the form**
→ Make sure you've submitted at least one feedback entry with that exact
10-digit mobile number first — it's a lookup, not a guess.

**Forgot the admin password**
→ Log in with another existing admin and delete + recreate the account
from Users → Admins. If there's only one admin and it's locked out,
manually update the `password_hash` column in MySQL with a fresh bcrypt
hash, or drop and re-run `npm run init-db` after clearing the `admins` table.
