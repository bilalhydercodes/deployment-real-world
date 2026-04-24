# Leave Request Fix Bugfix Design

## Overview

Two related bugs affect leave request handling for teachers. First, the `GET /api/leaves/my` route was restricted to the `student` role, causing teachers to receive a 403 when fetching their own leave history. As a workaround, the teacher frontend called `GET /api/leaves` (all school leaves) and filtered client-side, unnecessarily exposing all student leave data to the teacher. Second, because the `LeaveRequest` model stored all applicants in a `student` field with no role distinction, `getAllLeaves` returned teacher-submitted leaves alongside student leaves, polluting the admin/teacher review queue.

The fix introduces an `applicantRole` field on the `LeaveRequest` model, stamps it on creation, filters `getAllLeaves` to student-only records, opens `GET /api/leaves/my` to both roles, and updates the teacher frontend to call `/api/leaves/my` directly.

## Glossary

- **Bug_Condition (C)**: The set of inputs that trigger either bug — a teacher calling `GET /api/leaves/my`, or any call to `GET /api/leaves` when teacher-submitted leave records exist in the database
- **Property (P)**: The desired correct behavior — teachers receive their own leaves with 200; `getAllLeaves` returns only student-role leaves
- **Preservation**: Existing student leave submission, student leave history retrieval, and leave status update flows that must remain unchanged
- **applicantRole**: New field on `LeaveRequest` (`'student' | 'teacher'`) that identifies the role of the submitter
- **getAllLeaves**: Controller function in `leaveController.js` that returns the school's leave review queue
- **getMyLeaves**: Controller function in `leaveController.js` that returns the authenticated user's own leave history
- **loadTeacherLeave**: Client-side function in `teacher.html` that fetches and renders the teacher's personal leave history

## Bug Details

### Bug Condition

The bugs manifest in two distinct but related scenarios:

1. A teacher authenticates and requests `GET /api/leaves/my` — the route middleware rejects them with 403 because `authorize('student')` was the only allowed role.
2. Any call to `GET /api/leaves` when teacher-submitted leave records exist — `getAllLeaves` returned all records regardless of applicant role, mixing teacher leaves into the student review queue.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { userRole: string, endpoint: string, dbState: LeaveRequest[] }
  OUTPUT: boolean

  IF input.userRole = 'teacher' AND input.endpoint = 'GET /api/leaves/my'
    RETURN true   -- Bug 1: route was student-only

  IF input.endpoint = 'GET /api/leaves'
     AND EXISTS leave IN input.dbState WHERE leave.applicantRole = 'teacher'
    RETURN true   -- Bug 2: teacher leaves pollute the review queue

  RETURN false
END FUNCTION
```

### Examples

- Teacher calls `GET /api/leaves/my` → receives 403 (expected: 200 with their own leaves only)
- Teacher submits leave via `POST /api/leaves/teacher-apply`, then admin calls `GET /api/leaves` → teacher entry appears in student review queue (expected: only student leaves returned)
- Teacher frontend calls `GET /api/leaves` and filters client-side → all student leave data exposed to teacher's browser (expected: teacher only sees their own records via `/api/leaves/my`)
- Student calls `GET /api/leaves/my` → unaffected, continues to return 200 with student's own leaves

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Students submitting leave via `POST /api/leaves/apply` must continue to receive a 201 response
- Students calling `GET /api/leaves/my` must continue to receive only their own leave history
- Admins and teachers calling `PATCH /api/leaves/:id/status` must continue to update leave status correctly
- Teachers submitting leave via `POST /api/leaves/teacher-apply` must continue to receive a 201 response

**Scope:**
All inputs that do NOT involve a teacher calling `GET /api/leaves/my` or a mixed-role leave database state are completely unaffected by this fix. This includes:
- Student leave submission and retrieval
- Leave status review and update by admin/teacher
- All other dashboard features unrelated to leave

## Hypothesized Root Cause

1. **Missing role authorization on route**: `GET /api/leaves/my` in `leaveRoutes.js` used `authorize('student')` exclusively, blocking teachers at the middleware layer before the controller was reached.

2. **No applicant role field on the model**: `LeaveRequest` stored the submitter only as a `student` ObjectId reference with no field to distinguish whether the submitter was a student or teacher, making server-side filtering by role impossible.

3. **getAllLeaves lacked a role filter**: Without an `applicantRole` field, `getAllLeaves` had no predicate to exclude teacher-submitted records and returned everything for the school.

4. **Client-side workaround introduced data exposure**: Because `GET /api/leaves/my` was blocked for teachers, `loadTeacherLeave()` in `teacher.html` called `GET /api/leaves` and filtered client-side, leaking all student leave records to the teacher's browser.

## Correctness Properties

Property 1: Bug Condition - Teacher Leave Access and Queue Isolation

_For any_ authenticated teacher calling `GET /api/leaves/my`, the fixed route and `getMyLeaves` controller SHALL return HTTP 200 with only that teacher's own leave records. Additionally, for any call to `GET /api/leaves` regardless of the mix of applicant roles in the database, the fixed `getAllLeaves` SHALL return only records where `applicantRole === 'student'`, with no teacher-submitted records present.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Existing Student and Leave Management Flows

_For any_ input where the bug condition does NOT hold (student leave submission, student leave history retrieval, leave status updates, teacher leave submission), the fixed code SHALL produce the same result as the original code, preserving all existing functionality for those flows.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `server/routes/leaveRoutes.js`

**Change**: Open `GET /api/leaves/my` to both roles
- Change `authorize('student')` to `authorize('student', 'teacher')` on the `/my` route

---

**File**: `server/models/LeaveRequest.js`

**Change**: Add `applicantRole` field
- Add `applicantRole: { type: String, enum: ['student', 'teacher'], default: 'student' }` to the schema

---

**File**: `server/controllers/leaveController.js`

**Changes**:
1. **applyLeave**: Derive `applicantRole` from `req.user.role` and persist it on the new `LeaveRequest` document
2. **getAllLeaves**: Add `applicantRole: 'student'` to the Mongoose query filter so teacher leaves are excluded from the review queue
3. **getMyLeaves**: No change needed — already queries by `student: req.user._id`, which works for both roles since the field stores the submitter's ObjectId regardless of role

---

**File**: `client/pages/teacher.html`

**Change**: Fix `loadTeacherLeave` to call the correct endpoint
- Replace the `GET /api/leaves` call (with client-side filtering) with a direct call to `GET /api/leaves/my`

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write tests that call `GET /api/leaves/my` as a teacher and call `GET /api/leaves` after inserting a teacher-submitted leave. Run these on the UNFIXED code to observe failures.

**Test Cases**:
1. **Teacher GET /my returns 403**: Authenticate as teacher, call `GET /api/leaves/my`, assert 403 (will fail on fixed code, confirms Bug 1)
2. **Teacher leave in review queue**: Insert a leave with `applicantRole: 'teacher'`, call `GET /api/leaves`, assert teacher leave is present in results (will fail on fixed code, confirms Bug 2)
3. **Client-side data exposure**: Simulate `loadTeacherLeave` calling `GET /api/leaves`, assert it receives records belonging to other students (confirms data exposure)

**Expected Counterexamples**:
- `GET /api/leaves/my` returns 403 for teacher — confirms route authorization bug
- `GET /api/leaves` response includes records where `applicantRole === 'teacher'` — confirms missing filter bug

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed code produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedHandler(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Test Cases**:
1. Teacher calls `GET /api/leaves/my` → assert HTTP 200, all returned records belong to that teacher
2. `GET /api/leaves` with mixed-role DB state → assert zero records have `applicantRole === 'teacher'`
3. Teacher submits leave, then calls `GET /api/leaves/my` → assert their new record appears

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalHandler(input) = fixedHandler(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because it generates many test cases automatically, catches edge cases manual tests miss, and provides strong guarantees that behavior is unchanged for all non-buggy inputs.

**Test Cases**:
1. **Student apply preservation**: Student `POST /api/leaves/apply` → assert 201 and record created with `applicantRole: 'student'`
2. **Student GET /my preservation**: Student `GET /api/leaves/my` → assert 200 and only that student's records returned
3. **Status update preservation**: `PATCH /api/leaves/:id/status` with valid status → assert record updated, reviewer set
4. **Teacher apply preservation**: Teacher `POST /api/leaves/teacher-apply` → assert 201 and record created with `applicantRole: 'teacher'`

### Unit Tests

- Test `applyLeave` sets `applicantRole: 'student'` when called by a student
- Test `applyLeave` sets `applicantRole: 'teacher'` when called by a teacher
- Test `getAllLeaves` query filter excludes records with `applicantRole: 'teacher'`
- Test `getMyLeaves` returns only records matching `req.user._id` regardless of role
- Test route authorization allows teacher on `GET /api/leaves/my`

### Property-Based Tests

- Generate random combinations of student and teacher leave records; assert `getAllLeaves` never returns a teacher-role record
- Generate random teacher users; assert `getMyLeaves` always returns HTTP 200 and only their own records
- Generate random student leave submissions; assert `applicantRole` is always `'student'` on the created document

### Integration Tests

- Full flow: teacher submits leave → teacher views own history via `GET /api/leaves/my` → record appears correctly
- Full flow: teacher submits leave → admin calls `GET /api/leaves` → teacher leave absent from results
- Full flow: student submits leave → admin calls `GET /api/leaves` → student leave present in results
- Regression: student submits leave → student calls `GET /api/leaves/my` → only their own records returned
