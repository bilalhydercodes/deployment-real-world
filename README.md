# School Management System

Production-ready School Management System built with Node.js, Express, MongoDB Atlas, and vanilla HTML/Tailwind CSS.

---

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Backend  | Node.js + Express (MVC pattern)     |
| Database | MongoDB Atlas (Mongoose ODM)        |
| Auth     | JWT + bcrypt                        |
| Frontend | HTML + Tailwind CSS + Vanilla JS    |
| Hosting  | Railway / Render                    |

---

## Project Structure

```
deployment-real-world-main/
├── client/
│   ├── css/styles.css          # Orange + white theme
│   ├── js/                     # auth.js, attendance.js, marks.js, fees.js
│   └── pages/                  # login, register, student, teacher, admin
├── server/
│   ├── config/db.js            # MongoDB Atlas connection
│   ├── controllers/            # Business logic (MVC)
│   ├── middleware/             # auth, role, error, logger
│   ├── models/                 # Mongoose schemas with indexes
│   ├── routes/                 # Express routers
│   └── utils/                  # token, invite code, validators
├── .env.example
├── package.json
└── Procfile                    # Railway/Render deployment
```

---

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo-url>
cd deployment-real-world-main
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/schoolms?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_key_min_32_chars
JWT_EXPIRE=7d
CLIENT_ORIGIN=*
```

> Get your `MONGO_URI` from [MongoDB Atlas](https://cloud.mongodb.com) → Connect → Drivers → Node.js

### 3. Run locally

```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

Open `http://localhost:5000`

---

## MongoDB Atlas Setup

1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a database user (username + password)
3. Whitelist IP: `0.0.0.0/0` (allow all) for Railway/Render
4. Copy the connection string into `MONGO_URI` in `.env`
5. Indexes are created automatically by Mongoose on first run

---

## API Reference

### Authentication
| Method | Endpoint                        | Access  | Description              |
|--------|---------------------------------|---------|--------------------------|
| POST   | /api/auth/register              | Public  | Register admin/teacher   |
| POST   | /api/auth/login                 | Public  | Admin/teacher login      |
| POST   | /api/auth/student-login         | Public  | Student login (invite code) |
| GET    | /api/auth/me                    | Private | Get own profile          |
| GET    | /api/auth/students?page=1&limit=50 | Admin/Teacher | List students (paginated) |
| PATCH  | /api/auth/admin/lock-student    | Admin   | Lock/unlock student      |

### OTP (DB-backed, TTL auto-expiry)
| Method | Endpoint              | Description                    |
|--------|-----------------------|--------------------------------|
| POST   | /api/otp/send-otp     | Send OTP (stored in MongoDB)   |
| POST   | /api/otp/verify-otp   | Verify OTP (one-time use)      |

### Attendance
| Method | Endpoint                              | Description              |
|--------|---------------------------------------|--------------------------|
| POST   | /api/attendance/mark                  | Mark single attendance   |
| POST   | /api/attendance/bulk-mark             | Bulk mark for a class    |
| GET    | /api/attendance/:studentId?page=1     | Student's attendance     |
| GET    | /api/attendance?page=1                | All records (Admin)      |

### Marks
| Method | Endpoint                          | Description          |
|--------|-----------------------------------|----------------------|
| POST   | /api/marks/add                    | Add marks            |
| GET    | /api/marks/:studentId?page=1      | Student's marks      |
| GET    | /api/marks?page=1                 | All marks (Admin)    |

### Fees
| Method | Endpoint                          | Description              |
|--------|-----------------------------------|--------------------------|
| POST   | /api/fees/add                     | Add fee record (Admin)   |
| POST   | /api/fees/pay                     | Mark fee paid (Admin)    |
| GET    | /api/fees/:studentId?page=1       | Student's fees           |
| GET    | /api/fees?page=1&status=pending   | All fees (Admin)         |

### Discipline
| Method | Endpoint                              | Description              |
|--------|---------------------------------------|--------------------------|
| POST   | /api/discipline/report                | Report misconduct        |
| GET    | /api/discipline?page=1&action=pending | All cases (Admin)        |
| GET    | /api/discipline/student/:id           | Student's records        |
| PATCH  | /api/discipline/:id/action            | Take action (Admin)      |

### Sessions / Classes
| Method | Endpoint                  | Description              |
|--------|---------------------------|--------------------------|
| POST   | /api/sessions/create      | Create session (Admin)   |
| POST   | /api/sessions/claim       | Teacher claims session   |
| POST   | /api/sessions/add-students| Add students to session  |
| GET    | /api/sessions             | List sessions            |

---

## Pagination

All list endpoints support:
```
?page=1&limit=50
```
Response includes:
```json
{
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalPages": 4,
    "totalRecords": 180
  }
}
```

---

## MongoDB Indexes (Performance)

Every model has compound indexes for the most common queries:

| Collection  | Indexes                                          |
|-------------|--------------------------------------------------|
| users       | role, role+createdAt, name (text search)         |
| attendance  | studentId+date, studentId+subject, date          |
| marks       | studentId+createdAt, studentId+subject+examType  |
| fees        | studentId+status, studentId+dueDate, status+dueDate |
| discipline  | student+date, reportedBy+date, action, severity  |
| otps        | contact (TTL auto-expiry on expiresAt)           |

---

## OTP System

OTPs are stored in MongoDB Atlas with a **TTL index** — expired OTPs are automatically deleted by MongoDB, no cron job needed.

- Expiry: **5 minutes**
- One-time use: deleted immediately after successful verification
- Rate limited: max **5 requests per 10 minutes** per IP

To add real SMS/email delivery, edit `server/controllers/otpController.js` and uncomment the Twilio or Nodemailer block.

---

## Security

- Passwords hashed with **bcrypt** (10 salt rounds)
- JWT tokens expire in **7 days** (configurable via `JWT_EXPIRE`)
- Rate limiting: 100 req/15min globally, 5 req/10min for OTP
- Input validation on all endpoints
- `.select('-password')` on all user queries
- Students can only access their own data

---

## Deploy to Railway

1. Push code to GitHub
2. Create new project on [railway.app](https://railway.app)
3. Connect your GitHub repo
4. Add environment variables (same as `.env`)
5. Railway auto-detects `npm start` from `package.json`

## Deploy to Render

1. Push to GitHub
2. New Web Service on [render.com](https://render.com)
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables

---

## Default Login Flow

| Role    | Login Method                        | Portal              |
|---------|-------------------------------------|---------------------|
| Admin   | Email + Password                    | Staff tab → Admin   |
| Teacher | Invite Code (TCH-XXXXXX) + Password | Staff tab → Teacher |
| Student | Invite Code (STU-XXXXXX) + Password | Student tab         |

Admin creates teachers and students from the Admin Panel. Invite codes are auto-generated.
