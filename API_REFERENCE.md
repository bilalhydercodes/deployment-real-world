# College Management System — Postman API Reference

## Base URL
```
http://localhost:5000/api
```

## Health Check
```
GET /health
```
**Response:**
```json
{ "success": true, "message": "College Management API is running", "timestamp": "..." }
```

---

## 🔐 Auth Routes

### Register
```
POST /auth/register
Content-Type: application/json
```
**Body:**
```json
{
  "name": "Bilal Ahmed",
  "email": "bilal@college.edu",
  "password": "secret123",
  "role": "student"
}
```
**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": { "_id": "...", "name": "Bilal Ahmed", "email": "bilal@college.edu", "role": "student", "token": "<JWT>" }
}
```

---

### Login
```
POST /auth/login
Content-Type: application/json
```
**Body:**
```json
{ "email": "bilal@college.edu", "password": "secret123" }
```
**Response (200):**
```json
{ "success": true, "message": "Login successful", "data": { "token": "<JWT>", "role": "student" } }
```

---

### Get My Profile
```
GET /auth/me
Authorization: Bearer <JWT>
```
**Response:**
```json
{ "success": true, "data": { "_id": "...", "name": "Bilal Ahmed", "role": "student" } }
```

---

### Get All Students (Admin/Teacher)
```
GET /auth/students
Authorization: Bearer <JWT>
```

---

## 📋 Attendance Routes

### Mark Attendance (Teacher/Admin only)
```
POST /attendance/mark
Authorization: Bearer <JWT>
Content-Type: application/json
```
**Body:**
```json
{
  "studentId": "<MongoDB ObjectId>",
  "subject": "Mathematics",
  "date": "2026-03-24",
  "status": "present"
}
```
**Response (201):**
```json
{
  "success": true,
  "message": "Attendance marked successfully",
  "data": { "_id": "...", "status": "present", "subject": "Mathematics" }
}
```

---

### Get Student Attendance
```
GET /attendance/:studentId
Authorization: Bearer <JWT>
```
**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "summary": { "total": 20, "present": 18, "absent": 1, "late": 1, "percentage": "90.0%" }
}
```

---

### Get All Attendance (Admin only)
```
GET /attendance
Authorization: Bearer <JWT>
```

---

## 📊 Marks Routes

### Add Marks (Teacher/Admin only)
```
POST /marks/add
Authorization: Bearer <JWT>
Content-Type: application/json
```
**Body:**
```json
{
  "studentId": "<MongoDB ObjectId>",
  "subject": "Physics",
  "examType": "midterm",
  "marks": 85,
  "totalMarks": 100
}
```
**Response (201):**
```json
{
  "success": true,
  "message": "Marks added successfully",
  "data": { "_id": "...", "marks": 85, "grade": "A", "subject": "Physics" }
}
```
> **Grade calculation:**
> A+ ≥90 | A ≥80 | B ≥70 | C ≥60 | D ≥50 | F <50

---

### Get Student Marks
```
GET /marks/:studentId
Authorization: Bearer <JWT>
```

### Get All Marks (Admin only)
```
GET /marks
Authorization: Bearer <JWT>
```

---

## 💰 Fees Routes

### Add Fee (Admin only)
```
POST /fees/add
Authorization: Bearer <JWT>
Content-Type: application/json
```
**Body:**
```json
{
  "studentId": "<MongoDB ObjectId>",
  "feeType": "tuition",
  "amount": 15000,
  "dueDate": "2026-04-30",
  "description": "Semester 2 tuition"
}
```

---

### Mark Fee as Paid (Admin only)
```
POST /fees/pay
Authorization: Bearer <JWT>
Content-Type: application/json
```
**Body:**
```json
{ "feeId": "<MongoDB ObjectId>" }
```

---

### Get Student Fees
```
GET /fees/:studentId
Authorization: Bearer <JWT>
```
**Response:**
```json
{
  "success": true,
  "data": [...],
  "summary": { "total": 30000, "paid": 15000, "pending": 15000 }
}
```

---

## ❌ Error Responses

All errors follow this format:
```json
{ "success": false, "message": "Human-readable error description" }
```

| Code | Meaning |
|------|---------|
| 400 | Bad request / validation error / duplicate |
| 401 | Unauthenticated (missing/invalid/expired JWT) |
| 403 | Forbidden (wrong role) |
| 404 | API route not found |
| 500 | Internal server error |

---

## 🔐 Role Permissions Summary

| Route | Admin | Teacher | Student |
|-------|-------|---------|---------|
| POST `/auth/register` | ✅ | ✅ | ✅ |
| POST `/auth/login` | ✅ | ✅ | ✅ |
| GET `/auth/students` | ✅ | ✅ | ❌ |
| POST `/attendance/mark` | ✅ | ✅ | ❌ |
| GET `/attendance/:id` | ✅ | ✅ | ✅ (own only) |
| GET `/attendance` (all) | ✅ | ❌ | ❌ |
| POST `/marks/add` | ✅ | ✅ | ❌ |
| GET `/marks/:id` | ✅ | ✅ | ✅ (own only) |
| GET `/marks` (all) | ✅ | ❌ | ❌ |
| POST `/fees/add` | ✅ | ❌ | ❌ |
| POST `/fees/pay` | ✅ | ❌ | ❌ |
| GET `/fees/:id` | ✅ | ✅ | ✅ (own only) |
| GET `/fees` (all) | ✅ | ❌ | ❌ |
