# Comprehensive App Testing Bugfix Design

## Overview

Comprehensive testing of the school management application identified 30 bugs across authentication, role-based access control, data validation, session/assignment logic, and frontend integration. The fix strategy is minimal and targeted: each bug is addressed at the exact location it manifests, with no structural rewrites. Preservation of all existing correct behavior is verified through the unchanged-behavior requirements in bugfix.md §3.

## Glossary

- **Bug_Condition (C)**: The set of inputs or states that trigger a defect
- **Property (P)**: The correct behavior expected when the bug condition holds
- **Preservation**: All behaviors not covered by C(X) that must remain unchanged
- **isBugCondition(input)**: Pseudocode predicate returning true when a given input triggers a specific bug
- **schoolId scoping**: Filtering DB queries by `req.user.schoolId` to prevent cross-school data access
- **passwordRules**: The string exported from `validators.js` describing the 8-char + uppercase + number + special-char rule
- **isValidPassword**: Function in `validators.js` enforcing the above rule
- **TTL index**: MongoDB time-to-live index on `OTP.expiresAt` that auto-deletes expired documents

---

## Bug Details

### Bug Group A — Authentication & Password (Bugs 1.1, 1.2, 1.5, 1.7, 1.12)

#### Bug Condition

```
FUNCTION isBugCondition_A(input)
  INPUT: input of type PasswordResetOrAdminUpdateRequest
  OUTPUT: boolean

  RETURN (input.endpoint IN ['resetPassword', 'adminUpdatePassword']
          AND NOT isValidPassword(input.newPassword))
         OR (input.endpoint = 'verifyResetOTP'
             AND record.expiresAt <= new Date()
             AND TTL_has_not_fired_yet)
         OR (input.endpoint = 'adminUpdatePassword'
             AND input.userId belongs to different school)
         OR (User.schema.password.minlength = 6)
END FUNCTION
```

**Examples:**
- `resetPassword({ newPassword: "abc123A!" })` — 7 chars, `isValidPassword` returns false, but error says "at least 6 characters" (wrong message)
- `adminUpdatePassword({ newPassword: "weak" })` — rejected with "at least 6 characters" instead of `passwordRules`
- `adminUpdatePassword({ userId: userFromOtherSchool._id })` — succeeds, cross-school password reset
- `verifyResetOTP` called within 60s of TTL expiry — expired OTP accepted
- `User.create({ password: "abc123A" })` — 7 chars, passes Mongoose `minlength:6` but fails `isValidPassword`

### Bug Group B — OTP Teacher Login Flow (Bugs 1.3, 1.4)

#### Bug Condition

```
FUNCTION isBugCondition_B(input)
  INPUT: input of type TeacherLoginRequest
  OUTPUT: boolean

  RETURN input.staffLoginMode = 'teacher'
         AND contact_sent_to_send_otp = input.inviteCode  // not teacher's email
         OR (OTP stored with lowercase(inviteCode) but verified with original case)
END FUNCTION
```

**Examples:**
- Teacher with inviteCode `TCH-ABC123` logs in → OTP sent to `tch-abc123` as contact, not to teacher's email
- OTP stored as `tch-abc123`, client sends `TCH-ABC123` to verify → lookup fails (OTP model lowercases, but client sends original)

### Bug Group C — Role-Based Access Control (Bugs 1.8, 1.9, 1.10, 1.11, 1.13)

#### Bug Condition

```
FUNCTION isBugCondition_C(input)
  INPUT: input of type TeacherOrStudentRequest
  OUTPUT: boolean

  RETURN (input.role = 'teacher'
          AND input.endpoint IN ['getAttendance', 'getMarks', 'getFees', 'getBySession']
          AND studentId NOT IN teacher's sessions)
         OR (input.role = 'student'
             AND input.endpoint = 'getStudentDiscipline'
             AND input.studentId != req.user._id)
END FUNCTION
```

**Examples:**
- Teacher calls `GET /api/attendance/STUDENT_ID` for a student in another teacher's session → returns data (should be 403)
- Teacher calls `GET /api/marks/STUDENT_ID` for unrelated student → returns data (should be 403)
- Teacher calls `GET /api/fees/STUDENT_ID` for unrelated student → returns data (should be 403)
- Student calls `GET /api/discipline/student/OTHER_STUDENT_ID` → returns other student's records (should be 403)
- Teacher calls `GET /api/assignments/session/SESSION_ID` for session they don't belong to → returns assignments

### Bug Group D — Data Validation (Bugs 1.15, 1.16, 1.17, 1.18, 1.19, 1.20, 1.21, 1.22)

#### Bug Condition

```
FUNCTION isBugCondition_D(input)
  INPUT: input of type DataMutationRequest
  OUTPUT: boolean

  RETURN (input.endpoint = 'bulkMarkAttendance'
          AND any record missing studentId OR subject OR status)
         OR (input.endpoint = 'addFee'
             AND input.feeType NOT IN ['tuition','hostel','library','examination','other'])
         OR (input.endpoint = 'markAttendance'
             AND input.status NOT IN ['present','absent','late'])
         OR (input.endpoint = 'addMarks'
             AND input.examType NOT IN ['midterm','final','assignment','quiz'])
         OR (input.endpoint = 'getFees'
             AND summary.pending includes overdue fees)
         OR (input.endpoint = 'getAttendance'
             AND percentage denominator = paginated_count NOT all_records_count)
         OR (input.endpoint = 'bulk-create-student'
             AND student.password fails isValidPassword)
END FUNCTION
```

**Examples:**
- `bulkMarkAttendance([{ studentId, status: 'present' }])` — missing `subject` → 500 instead of 400
- `addFee({ feeType: 'invalid' })` → 500 Mongoose validation error instead of 400
- `markAttendance({ status: 'tardy' })` → 500 instead of 400
- `addMarks({ examType: 'test' })` → 500 instead of 400
- `getFees` with 2 pending + 1 overdue → summary.pending = sum of all 3 (misleading)
- `getAttendance` with 100 records, page limit 10 → percentage = present/10 instead of present/100
- `bulk-create-student` with password `"abc"` → stored without validation

### Bug Group E — Session & Assignment Logic (Bugs 1.24, 1.25)

#### Bug Condition

```
FUNCTION isBugCondition_E(input)
  INPUT: input of type SessionOrAssignmentRequest
  OUTPUT: boolean

  RETURN (input.endpoint = 'submitAssignment'
          AND student NOT enrolled in assignment.sessionId)
         OR (input.endpoint = 'claimSession'
             AND req.user._id IN session.teachers)
END FUNCTION
```

**Examples:**
- Student not in session submits assignment for that session → 200 success (should be 403)
- Teacher calls `claimSession` twice → second call returns "Session claimed successfully!" (should indicate already member)

### Bug Group F — Frontend Issues (Bugs 1.26, 1.27, 1.28, 1.29, 1.30)

#### Bug Condition

```
FUNCTION isBugCondition_F(input)
  INPUT: input of type FrontendAction
  OUTPUT: boolean

  RETURN (input.action = 'genPassword'
          AND generated password contains no special character)
         OR (input.action = 'staffLoginOTPComplete'
             AND role NOT IN ['admin', 'teacher'])
         OR (input.action = 'apiFetch_admin'
             AND res.ok = false
             AND caller catch block is empty)
         OR (input.action = 'staffLoginStep1'
             AND server returns 'Students must login via the Student Portal'
             AND frontend shows 'Invalid credentials')
         OR (input.action = 'apiFetch_auth'
             AND res.ok = false
             AND function does NOT throw)
END FUNCTION
```

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Valid admin registration with strong password continues to work (3.1)
- Valid admin/teacher login with correct credentials continues to return JWT (3.2)
- Valid student login with invite code continues to work (3.3)
- Teacher marking attendance for students in their sessions continues to work (3.4)
- Admin adding marks for any student in their school continues to work (3.5)
- Admin adding fee records continues to work (3.6)
- Admin creating sessions continues to work (3.7)
- Teacher claiming a new session continues to work (3.8)
- Student applying for leave continues to work (3.9)
- Admin approving class requests continues to work (3.10)
- Notice cache busting continues to work (3.11)
- Locked student accounts continue to be blocked (3.12)
- Expired JWT continues to return 401 (3.13)
- NoSQL injection sanitization continues to work (3.14)
- OTP TTL auto-deletion continues to work (3.15)
- Default feeType 'tuition' continues to work (3.16)
- Bulk attendance for authorized students continues to work (3.17)

**Scope:** All inputs that do NOT match the bug conditions above are completely unaffected by these fixes.

---

## Hypothesized Root Cause

1. **Copy-paste error message**: `resetPassword` and `adminUpdatePassword` both have hardcoded `'Password must be at least 6 characters'` instead of using the `passwordRules` constant from validators.js

2. **OTP contact is invite code not email**: The frontend sends `contact = inviteCode` to `/api/otp/send-otp` for teacher login. The fix is to send the teacher's email (from `data.data.email`) when available, falling back to the invite code for console-only OTP.

3. **OTP case normalization**: The OTP model lowercases the contact field. Since invite codes are uppercase and the model lowercases them, the stored key is lowercase. The verify step sends the original mixed-case value. The fix is to normalize the contact to lowercase before sending to both send-otp and verify-otp.

4. **Missing expiry check**: `verifyResetOTP` relies solely on TTL deletion. Adding an explicit `record.expiresAt > new Date()` check provides defense-in-depth.

5. **Schema minlength mismatch**: `User.js` has `minlength: 6` but `isValidPassword` requires 8+. Fix: change to `minlength: 8`.

6. **Missing schoolId scope in adminUpdatePassword**: `User.findById(userId)` has no schoolId filter. Fix: add `schoolId: req.user.schoolId` to the query.

7. **Missing teacher scope checks**: `getAttendance`, `getMarks`, `getFees`, `getStudentDiscipline` only check `req.user.role === 'student'` but not teacher scope. Fix: add the same session-based scope check used in `markAttendance`.

8. **Missing authorize middleware on assignment route**: `GET /api/assignments/session/:sessionId` has no role restriction and the controller only checks `schoolId`. Fix: add session membership check in controller.

9. **No per-record validation in bulkMarkAttendance**: Records are filtered for authorization but not validated for required fields. Fix: add field validation before `insertMany`.

10. **No enum validation before save**: `addFee`, `markAttendance`, `addMarks` let Mongoose throw on invalid enum values. Fix: validate enums explicitly before calling `.create()`.

11. **Fees summary misleading**: `pendingAmt` uses `status !== 'paid'` which includes overdue. Fix: split into separate `pending` and `overdue` fields.

12. **Attendance percentage wrong denominator**: Uses paginated `total` instead of `all.length`. Fix: use `all.length`.

13. **bulk-create-student no password validation**: Fix: call `isValidPassword` per student and skip invalid ones.

14. **submitAssignment no session check**: Fix: verify student is in `assignment.sessionId` before allowing submission.

15. **claimSession no idempotency message**: Fix: return `{ alreadyMember: true }` when teacher is already in session.

16. **genPassword may omit special char**: Fix: guarantee at least one special char by injecting one at a random position.

17. **Frontend error message passthrough**: Fix: use `data.message` from server response in toast instead of hardcoded string.

18. **apiFetch in auth.js doesn't throw**: Fix: add `if (!res.ok) throw new Error(data.message || 'Request failed')` consistent with admin.js.

---

## Correctness Properties

Property 1: Bug Condition - Password Validation Error Messages

_For any_ call to `resetPassword` or `adminUpdatePassword` where `isValidPassword(newPassword)` returns false, the fixed functions SHALL return HTTP 400 with the `passwordRules` string from `validators.js`.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - Teacher OTP Sent to Email

_For any_ teacher login where the teacher has a registered email address, the fixed frontend SHALL send the teacher's email (not the invite code) as the `contact` to `/api/otp/send-otp`, and SHALL normalize the contact to lowercase before both sending and verifying.

**Validates: Requirements 2.3, 2.4**

Property 3: Bug Condition - OTP Expiry Defense-in-Depth

_For any_ call to `verifyResetOTP` where `record.expiresAt <= new Date()`, the fixed function SHALL return HTTP 400 "Invalid or expired OTP." regardless of whether the TTL index has fired.

**Validates: Requirements 2.5**

Property 4: Bug Condition - Teacher Scope Enforcement

_For any_ teacher request to `getAttendance`, `getMarks`, `getFees`, or `getBySession` where the target student is NOT in any of the teacher's sessions, the fixed controllers SHALL return HTTP 403.

**Validates: Requirements 2.8, 2.9, 2.10, 2.12**

Property 5: Bug Condition - Student Cross-Access Prevention

_For any_ student request to `getStudentDiscipline` where `studentId != req.user._id`, the fixed controller SHALL return HTTP 403.

**Validates: Requirements 2.11** (note: bug 1.11 maps to expected behavior 2.11 which is about adminUpdatePassword schoolId scoping; the discipline fix is part of the RBAC group)

Property 6: Bug Condition - Admin Cross-School Password Reset Prevention

_For any_ call to `adminUpdatePassword` where the target user's `schoolId` does not match `req.user.schoolId`, the fixed function SHALL return HTTP 404 (user not found in this school).

**Validates: Requirements 2.11**

Property 7: Bug Condition - Enum Validation Returns 400

_For any_ call to `addFee`, `markAttendance`, or `addMarks` with an invalid enum value (`feeType`, `status`, `examType` respectively), the fixed controllers SHALL return HTTP 400 before attempting to save.

**Validates: Requirements 2.16, 2.17, 2.18**

Property 8: Bug Condition - Bulk Attendance Record Validation

_For any_ call to `bulkMarkAttendance` containing a record missing `studentId`, `subject`, or `status`, the fixed controller SHALL return HTTP 400 with a descriptive message.

**Validates: Requirements 2.14, 2.15**

Property 9: Bug Condition - Fees Summary Accuracy

_For any_ call to `getFees` where the student has both `pending` and `overdue` fee records, the fixed controller SHALL return separate `pending` and `overdue` amounts in the summary.

**Validates: Requirements 2.19**

Property 10: Bug Condition - Attendance Percentage Correct Denominator

_For any_ call to `getAttendance` where the total record count exceeds the page limit, the fixed controller SHALL calculate the attendance percentage using `all.length` (total records) as the denominator.

**Validates: Requirements 2.20**

Property 11: Bug Condition - Assignment Submission Session Check

_For any_ call to `submitAssignment` by a student NOT enrolled in the assignment's session, the fixed controller SHALL return HTTP 403.

**Validates: Requirements 2.22**

Property 12: Bug Condition - ClaimSession Idempotency

_For any_ call to `claimSession` by a teacher already in `session.teachers`, the fixed controller SHALL return a response with `alreadyMember: true` rather than "Session claimed successfully!".

**Validates: Requirements 2.23**

Property 13: Bug Condition - genPassword Always Contains Special Character

_For any_ call to `genPassword` or `genTeacherPassword`, the fixed function SHALL always produce a password containing at least one character from `@#!`.

**Validates: Requirements 2.24**

Property 14: Preservation - Non-Buggy Inputs Unchanged

_For any_ input where none of the bug conditions above hold (valid passwords, authorized teachers, valid enum values, etc.), the fixed code SHALL produce exactly the same result as the original code.

**Validates: Requirements 3.1–3.17**

---

## Fix Implementation

### Changes Required

**File: `server/controllers/forgotPasswordController.js`**
- Bug 1.1: Replace `'Password must be at least 6 characters'` in `resetPassword` with `passwordRules` (import it)
- Bug 1.2: Replace `'Password must be at least 6 characters'` in `adminUpdatePassword` with `passwordRules`
- Bug 1.5: Add `if (record.expiresAt <= new Date())` check in `verifyResetOTP` before accepting OTP
- Bug 1.12: Change `User.findById(userId)` in `adminUpdatePassword` to `User.findOne({ _id: userId, schoolId: req.user.schoolId })`

**File: `server/models/User.js`**
- Bug 1.7: Change `minlength: 6` to `minlength: 8` on the `password` field

**File: `server/controllers/attendanceController.js`**
- Bug 1.8: Add teacher scope check in `getAttendance` (same pattern as `markAttendance`)
- Bug 1.15: Add per-record field validation in `bulkMarkAttendance` before `insertMany`
- Bug 1.16: Return accepted/rejected counts in `bulkMarkAttendance` response
- Bug 1.18: Validate `status` enum in `markAttendance` before calling `Attendance.create`
- Bug 1.21: Fix percentage denominator in `getAttendance` to use `all.length`

**File: `server/controllers/marksController.js`**
- Bug 1.9: Add teacher scope check in `getMarks`
- Bug 1.19: Validate `examType` enum in `addMarks` before calling `Marks.create`

**File: `server/controllers/feesController.js`**
- Bug 1.10: Add teacher scope check in `getFees`
- Bug 1.17: Validate `feeType` enum in `addFee` before calling `Fees.create`
- Bug 1.20: Split `pendingAmt` into separate `pending` and `overdue` in `getFees` summary

**File: `server/controllers/disciplineController.js`**
- Bug 1.11: Add teacher scope check in `getStudentDiscipline` (teachers can only view discipline for their students)

**File: `server/controllers/assignmentController.js`**
- Bug 1.13: Add session membership check in `getBySession` for teacher role
- Bug 1.24: Add session enrollment check in `submitAssignment`

**File: `server/controllers/sessionController.js`**
- Bug 1.25: Return `{ alreadyMember: true }` when teacher is already in `session.teachers`

**File: `server/routes/assignmentRoutes.js`**
- Bug 1.13: Add `authorize('admin', 'teacher', 'student')` or keep open but enforce in controller (controller fix is sufficient)

**File: `server/routes/teacherRoutes.js`**
- Bug 1.22: Add `isValidPassword` check per student in `bulk-create-student` route handler

**File: `client/pages/login-scripts.js`**
- Bug 1.3: Send `data.data.email` (if available) instead of `inviteCode` as contact to `/api/otp/send-otp` for teacher login
- Bug 1.4: Normalize contact to lowercase before sending to both send-otp and verify-otp
- Bug 1.27: Change fallback redirect to show error instead of redirecting to `student.html`
- Bug 1.29: Use `data.message` from server response in the error toast instead of hardcoded string

**File: `client/js/admin.js`**
- Bug 1.26: Fix `genPassword` and `genTeacherPassword` to guarantee at least one special character
- Bug 1.28: Update callers of `apiFetch` that have empty `catch(e) {}` to update UI state on error

**File: `client/js/auth.js`**
- Bug 1.30: Add `if (!res.ok) throw new Error(data.message || 'Request failed')` in `apiFetch`

---

## Testing Strategy

### Validation Approach

Two-phase: first confirm bugs exist on unfixed code (exploratory), then verify fixes work and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples demonstrating each bug before the fix.

**Test Cases:**
1. Call `resetPassword` with `newPassword: "Abc1234!"` (7 chars) → expect wrong error message
2. Call `adminUpdatePassword` with weak password → expect wrong error message
3. Teacher login flow → observe `contact` sent to send-otp is invite code, not email
4. Call `verifyResetOTP` with manually expired record (expiresAt in past) → expect acceptance
5. Call `getAttendance` as teacher for student not in sessions → expect data returned (should be 403)
6. Call `addFee` with `feeType: 'invalid'` → expect 500
7. Call `submitAssignment` as student not in session → expect 200 (should be 403)
8. Call `claimSession` twice → expect "claimed successfully" both times

**Expected Counterexamples:**
- Wrong error messages on password validation
- Cross-school/cross-session data access succeeds
- Invalid enum values cause 500 instead of 400

### Fix Checking

```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

### Preservation Checking

```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: Property-based testing for password generation (Property 13) and manual integration tests for auth flows.

### Unit Tests

- Test `resetPassword` and `adminUpdatePassword` with weak passwords → verify `passwordRules` message
- Test `getAttendance`/`getMarks`/`getFees` as teacher for out-of-scope student → verify 403
- Test `addFee`/`markAttendance`/`addMarks` with invalid enum values → verify 400
- Test `bulkMarkAttendance` with missing fields → verify 400
- Test `submitAssignment` for unenrolled student → verify 403
- Test `claimSession` twice → verify `alreadyMember: true` on second call

### Property-Based Tests

- Generate 1000 passwords with `genPassword` → assert all contain at least one of `@#!`
- Generate random attendance records with missing fields → assert all return 400
- Generate random fee records with invalid feeType → assert all return 400

### Integration Tests

- Full teacher login flow with email → verify OTP sent to email
- Full password reset flow → verify expiry check works
- Admin password reset scoped to school → verify cross-school attempt returns 404
- Student submit assignment for enrolled session → verify 200; for unenrolled → verify 403
