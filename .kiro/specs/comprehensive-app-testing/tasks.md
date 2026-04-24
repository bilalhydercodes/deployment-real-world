# Comprehensive App Testing — Fix Tasks

- [x] 1. Fix password error messages and schema (Bugs 1.1, 1.2, 1.7)
  - [x] 1.1 Fix resetPassword error message to use passwordRules
  - [x] 1.2 Fix adminUpdatePassword error message to use passwordRules
  - [x] 1.3 Fix User model password minlength from 6 to 8

- [x] 2. Fix forgotPassword OTP expiry and cross-school scope (Bugs 1.5, 1.12)
  - [x] 2.1 Add explicit expiresAt check in verifyResetOTP
  - [x] 2.2 Scope adminUpdatePassword user lookup to req.user.schoolId

- [x] 3. Fix teacher OTP login flow (Bugs 1.3, 1.4)
  - [x] 3.1 Send teacher email (not invite code) as OTP contact in login-scripts.js
  - [x] 3.2 Normalize contact to lowercase before send-otp and verify-otp calls

- [x] 4. Fix teacher RBAC scope checks (Bugs 1.8, 1.9, 1.10, 1.11, 1.13)
  - [x] 4.1 Add teacher scope check in getAttendance
  - [x] 4.2 Add teacher scope check in getMarks
  - [x] 4.3 Add teacher scope check in getFees
  - [x] 4.4 Add teacher scope check in getStudentDiscipline
  - [x] 4.5 Add session membership check in getBySession (assignments)

- [x] 5. Fix data validation — enum checks (Bugs 1.17, 1.18, 1.19)
  - [x] 5.1 Validate feeType enum in addFee before save
  - [x] 5.2 Validate status enum in markAttendance before save
  - [x] 5.3 Validate examType enum in addMarks before save

- [x] 6. Fix bulk attendance validation and reporting (Bugs 1.15, 1.16)
  - [x] 6.1 Add per-record field validation in bulkMarkAttendance
  - [x] 6.2 Return accepted/rejected counts in bulkMarkAttendance response

- [x] 7. Fix fees summary and attendance percentage (Bugs 1.20, 1.21)
  - [x] 7.1 Split fees summary into separate pending and overdue amounts
  - [x] 7.2 Fix attendance percentage denominator to use all.length

- [x] 8. Fix bulk-create-student password validation (Bug 1.22)
  - [x] 8.1 Add isValidPassword check per student in bulk-create-student route

- [x] 9. Fix assignment submission session check (Bug 1.24)
  - [x] 9.1 Add session enrollment check in submitAssignment

- [x] 10. Fix claimSession idempotency response (Bug 1.25)
  - [x] 10.1 Return alreadyMember: true when teacher already in session.teachers

- [x] 11. Fix frontend password generation (Bug 1.26)
  - [x] 11.1 Fix genPassword to guarantee at least one special character
  - [x] 11.2 Fix genTeacherPassword to guarantee at least one special character

- [x] 12. Fix frontend error handling and messages (Bugs 1.27, 1.28, 1.29, 1.30)
  - [x] 12.1 Fix staff login unexpected role redirect (Bug 1.27)
  - [x] 12.2 Fix admin.js apiFetch callers to update UI on error (Bug 1.28)
  - [x] 12.3 Fix login-scripts.js to show server error message (Bug 1.29)
  - [x] 12.4 Fix auth.js apiFetch to throw on non-OK response (Bug 1.30)
