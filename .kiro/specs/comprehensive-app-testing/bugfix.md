# Bugfix Requirements Document

## Introduction

Comprehensive testing of the school management application revealed multiple bugs spanning authentication flows, password validation inconsistencies, role-based access control gaps, data integrity issues, and frontend-backend integration problems. These bugs affect admin, teacher, and student roles across all major modules: auth, fees, marks, attendance, sessions, assignments, discipline, leaves, timetable, notices, and class requests.

---

## Bug Analysis

### Current Behavior (Defect)

**Authentication & Password**

1.1 WHEN `resetPassword` is called with a weak password THEN the system accepts it because the error message says "at least 6 characters" but `isValidPassword` enforces 8+ chars with uppercase, number, and special character — the validation runs but the error message is misleading and inconsistent with the register/login flow

1.2 WHEN `adminUpdatePassword` is called with a weak password THEN the system rejects it with the message "Password must be at least 6 characters" even though `isValidPassword` requires 8+ chars with uppercase, number, and special character — the error message is wrong

1.3 WHEN a teacher logs in via the staff login flow THEN the OTP is sent to the teacher's invite code (not an email address), so `sendOTPEmail` is never called and the OTP only appears in the server console — teachers with no email address cannot receive OTPs

1.4 WHEN a teacher logs in and the OTP contact is the invite code (e.g. `TCH-ABC123`) THEN the OTP is stored under that invite code as the contact key, but the OTP model lowercases all contacts — the invite code is stored as `tch-abc123` while the verify step sends the original mixed-case value, causing OTP lookup to fail if the client sends the original case

1.5 WHEN `verifyResetOTP` is called and the OTP record has expired (TTL deleted it) THEN the system returns "Invalid or expired OTP" but does NOT check the `expiresAt` field manually — if the MongoDB TTL index has not yet fired (TTL runs every 60 seconds), an expired OTP can still be used

1.6 WHEN a student tries to log in via the admin/teacher login form (`/api/auth/login`) THEN the system returns "Students must login via the Student Portal" — but the frontend staff login form does not display this specific message to the user, it shows a generic "Invalid credentials" toast

1.7 WHEN the `User` model schema defines `password` with `minlength: 6` THEN passwords of 6 or 7 characters pass Mongoose validation even though `isValidPassword` requires 8+ characters — the schema constraint is inconsistent with the application-level rule, allowing weak passwords to be stored if validation is bypassed

**Role-Based Access Control**

1.8 WHEN a teacher calls `GET /api/attendance/:studentId` for a student NOT in their sessions THEN the system returns the attendance data anyway — the `getAttendance` controller only checks `req.user.role === 'student'` for access restriction, not teacher scope

1.9 WHEN a teacher calls `GET /api/marks/:studentId` for a student NOT in their sessions THEN the system returns the marks data anyway — the `getMarks` controller only checks `req.user.role === 'student'` for access restriction, not teacher scope

1.10 WHEN a teacher calls `GET /api/fees/:studentId` for a student NOT in their sessions THEN the system returns the fee data anyway — the `getFees` controller only checks `req.user.role === 'student'` for access restriction, not teacher scope

1.11 WHEN a student calls `GET /api/discipline/student/:studentId` with another student's ID THEN the system returns that student's discipline records — the `getStudentDiscipline` controller checks `req.user._id.toString() !== studentId` but does not verify teacher scope

1.12 WHEN an admin calls `PATCH /api/admin/update-password/:userId` THEN the system updates the password for ANY user by ID with no `schoolId` scoping — an admin can reset passwords for users belonging to other schools

1.13 WHEN a teacher calls `GET /api/assignments/session/:sessionId` for a session they do not belong to THEN the system returns all assignments for that session — the route has no `authorize` middleware and the controller only checks `schoolId`, not whether the requester is in that session

1.14 WHEN a teacher calls `POST /api/leaves/apply` THEN the system creates a leave request for the teacher — the leave route only uses `protect` with no `authorize('student')` restriction, so teachers can submit leave requests that appear in the admin queue mixed with student requests

**Data Integrity & Validation**

1.15 WHEN `bulkMarkAttendance` is called with records that have no `subject` field THEN the system inserts them anyway because there is no per-record validation before `insertMany` — the Attendance model requires `subject`, so MongoDB throws a validation error that surfaces as a 500 instead of a 400

1.16 WHEN `bulkMarkAttendance` is called with a mix of authorized and unauthorized student IDs THEN the system silently drops the unauthorized records and saves only the authorized ones, returning 201 with a count that does not match the input — the caller has no way to know some records were dropped

1.17 WHEN `addFee` is called with an invalid `feeType` value (e.g. `"invalid"`) THEN the system attempts to save and Mongoose throws a validation error (500) instead of returning a clean 400

1.18 WHEN `markAttendance` is called with an invalid `status` value (not `present`, `absent`, or `late`) THEN the system attempts to save and Mongoose throws a validation error (500) instead of returning a clean 400 validation response

1.19 WHEN `addMarks` is called with an invalid `examType` (not `midterm`, `final`, `assignment`, or `quiz`) THEN the system attempts to save and Mongoose throws a validation error (500) instead of returning a clean 400 validation response

1.20 WHEN `getFees` is called for a student, the summary `pending` amount includes `overdue` fees (because the filter is `status !== 'paid'`) — the summary label says "pending" but actually means "unpaid" (pending + overdue combined), which is misleading

1.21 WHEN `getAttendance` calculates the attendance percentage THEN it divides `present` (counted from all records) by `total` (the paginated `countDocuments` result) — if the page limit is smaller than the total record count, the percentage is calculated against the wrong denominator and produces an incorrect value

1.22 WHEN `bulk-create-student` processes students from a CSV import THEN it calls `User.create` for each student without running `isValidPassword` — weak passwords from CSV imports bypass application-level validation and are stored in the database

**Session & Assignment Logic**

1.23 WHEN `getMyAssignments` is called by a teacher THEN the filter uses `createdBy: req.user._id` — but if a teacher was deleted and recreated, their old assignments are orphaned and never returned

1.24 WHEN `submitAssignment` is called by a student for an assignment in a session they are NOT enrolled in THEN the system allows the submission — there is no check that the student belongs to the assignment's session

1.25 WHEN `claimSession` is called by a teacher who is already in `session.teachers` THEN the response still returns 200 with the message "Session claimed successfully!" with no indication that no change was made

**Frontend Issues**

1.26 WHEN the `genPassword` function generates a password for a new student or teacher THEN the character set `'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!'` only contains `@`, `#`, and `!` as special characters — the generated password may not always contain a special character (it is random), causing the `isValidPassword` check to fail on submission

1.27 WHEN the staff login OTP step completes and the user's role is not `admin` or `teacher` THEN the frontend redirects to `student.html` — but staff (admin/teacher) should never reach this branch; if they do, they land on the wrong page

1.28 WHEN `apiFetch` in `admin.js` receives a non-OK response THEN it throws an error AND calls `showToast` — but the calling code also has a `catch(e) {}` that silently swallows the error, so the user sees the toast but the UI state is not updated (e.g. table stays in loading state)

1.29 WHEN a student attempts to log in via the staff login form and the server returns "Students must login via the Student Portal" THEN the frontend displays a generic "Invalid credentials" toast instead of the specific server message — the user is not guided to the correct login form

1.30 WHEN `apiFetch` in `auth.js` (used by teacher and student pages) receives a non-OK response THEN it does NOT throw — it returns the data object silently, unlike the `admin.js` version which throws on `!res.ok` — this inconsistency means teacher/student page error handling behaves differently from admin pages

---

### Expected Behavior (Correct)

**Authentication & Password**

2.1 WHEN `resetPassword` is called with a weak password THEN the system SHALL reject it with the `passwordRules` string from `validators.js`

2.2 WHEN `adminUpdatePassword` is called with a weak password THEN the system SHALL reject it with the correct `passwordRules` error message

2.3 WHEN a teacher logs in via the staff login flow THEN the system SHALL send the OTP to the teacher's registered email address (if available), not to the invite code string

2.4 WHEN an OTP contact is stored THEN the system SHALL normalize it consistently (lowercase) so that lookup always succeeds regardless of the case the client sends

2.5 WHEN `verifyResetOTP` is called THEN the system SHALL explicitly check `record.expiresAt > new Date()` before accepting the OTP, as a defense-in-depth measure independent of the TTL index

2.6 WHEN a student attempts to log in via the staff login form THEN the frontend SHALL display the specific server message "Students must login via the Student Portal" to guide the user

2.7 WHEN the `User` model schema defines the `password` field THEN the `minlength` SHALL be set to 8 to match the `isValidPassword` application-level rule

**Role-Based Access Control**

2.8 WHEN a teacher calls `GET /api/attendance/:studentId` THEN the system SHALL verify the student is in one of the teacher's sessions before returning data

2.9 WHEN a teacher calls `GET /api/marks/:studentId` THEN the system SHALL verify the student is in one of the teacher's sessions before returning data

2.10 WHEN a teacher calls `GET /api/fees/:studentId` THEN the system SHALL verify the student is in one of the teacher's sessions before returning data

2.11 WHEN `adminUpdatePassword` is called THEN the system SHALL scope the user lookup to `req.user.schoolId` so admins cannot reset passwords for users in other schools

2.12 WHEN a teacher calls `GET /api/assignments/session/:sessionId` THEN the system SHALL verify the teacher belongs to that session before returning assignments

2.13 WHEN `POST /api/leaves/apply` is called THEN the system SHALL restrict access to students only via `authorize('student')` middleware

**Data Integrity & Validation**

2.14 WHEN `bulkMarkAttendance` is called THEN the system SHALL validate each record for required fields (`studentId`, `subject`, `status`) and return a 400 with a descriptive message if any record is invalid

2.15 WHEN `bulkMarkAttendance` filters out unauthorized student records THEN the system SHALL inform the caller how many records were accepted vs. rejected instead of silently dropping them

2.16 WHEN `addFee` is called with an invalid `feeType` THEN the system SHALL return a 400 validation error before attempting to save

2.17 WHEN `markAttendance` is called with an invalid `status` THEN the system SHALL return a 400 validation error before attempting to save

2.18 WHEN `addMarks` is called with an invalid `examType` THEN the system SHALL return a 400 validation error before attempting to save

2.19 WHEN `getFees` returns a summary THEN the system SHALL split the non-paid amount into separate `pending` and `overdue` fields to accurately reflect the data

2.20 WHEN `getAttendance` calculates the attendance percentage THEN it SHALL use `all.length` (total records fetched for summary) as the denominator, not the paginated `countDocuments` value

2.21 WHEN `bulk-create-student` processes each student THEN the system SHALL run `isValidPassword` on each password and skip (or reject) students with invalid passwords, returning a report of which students were skipped

**Session & Assignment Logic**

2.22 WHEN `submitAssignment` is called by a student THEN the system SHALL verify the student is enrolled in the assignment's session before allowing submission

2.23 WHEN `claimSession` is called by a teacher who is already in `session.teachers` THEN the system SHALL return a response indicating the teacher was already a member (e.g. `{ alreadyMember: true }`) rather than "claimed successfully"

**Frontend Issues**

2.24 WHEN `genPassword` generates a password THEN the function SHALL guarantee at least one special character is included in the output so the password always passes `isValidPassword`

2.25 WHEN the staff login OTP step completes with an unexpected role THEN the frontend SHALL redirect to the correct page based on role or show an error, not silently redirect to `student.html`

2.26 WHEN `apiFetch` in `admin.js` throws after a failed API call THEN the calling code SHALL update the UI state (e.g. show error row in table) rather than silently swallowing the error in `catch(e) {}`

2.27 WHEN `apiFetch` in `auth.js` receives a non-OK response THEN it SHALL throw an error (consistent with the `admin.js` version) so that all pages handle errors uniformly

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a valid admin registers with a strong password THEN the system SHALL CONTINUE TO create the account and return a JWT token

3.2 WHEN a valid admin or teacher logs in with correct credentials THEN the system SHALL CONTINUE TO return a JWT token and user data

3.3 WHEN a valid student logs in with their invite code and password THEN the system SHALL CONTINUE TO authenticate and return a JWT token

3.4 WHEN a teacher marks attendance for a student in their session THEN the system SHALL CONTINUE TO create the attendance record successfully

3.5 WHEN an admin adds marks for any student in their school THEN the system SHALL CONTINUE TO create the marks record and auto-calculate the grade

3.6 WHEN an admin adds a fee record for a student THEN the system SHALL CONTINUE TO create the fee record with the correct status

3.7 WHEN an admin creates a session THEN the system SHALL CONTINUE TO generate a unique session code and return the session data

3.8 WHEN a teacher claims a session by code for the first time THEN the system SHALL CONTINUE TO add them to the session's teachers array

3.9 WHEN a student applies for leave THEN the system SHALL CONTINUE TO create the leave request with pending status

3.10 WHEN an admin approves a class request THEN the system SHALL CONTINUE TO auto-create the corresponding timetable entry

3.11 WHEN a notice is created THEN the system SHALL CONTINUE TO bust the notice cache so all users see the update immediately

3.12 WHEN a student's account is locked by admin THEN the system SHALL CONTINUE TO block that student from authenticating

3.13 WHEN a JWT token is expired THEN the system SHALL CONTINUE TO return 401 with "Session expired" message

3.14 WHEN a request contains NoSQL injection patterns THEN the system SHALL CONTINUE TO sanitize and block the attack

3.15 WHEN the OTP TTL expires in MongoDB THEN the system SHALL CONTINUE TO auto-delete the OTP document

3.16 WHEN an admin adds a valid fee record THEN the system SHALL CONTINUE TO default `feeType` to `'tuition'` when not provided

3.17 WHEN a teacher bulk-marks attendance for authorized students THEN the system SHALL CONTINUE TO insert all valid records successfully
