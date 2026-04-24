# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Teacher Leave Access and Queue Isolation
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - **Scoped PBT Approach**: Scope to the two concrete failing cases for reproducibility
  - Test 1 (Bug 1): Authenticate as teacher, call `GET /api/leaves/my`, assert HTTP 403 is returned (confirms route was student-only)
  - Test 2 (Bug 2): Insert a `LeaveRequest` with `applicantRole: 'teacher'`, call `GET /api/leaves` as admin, assert the teacher record appears in results (confirms missing filter)
  - Test 3 (Data exposure): Simulate `loadTeacherLeave` calling `GET /api/leaves`, assert response includes records belonging to other students
  - Expected counterexamples: `GET /api/leaves/my` returns 403 for teacher; `GET /api/leaves` response includes records where `applicantRole === 'teacher'`
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found to understand root cause
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Student and Leave Management Flows
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `POST /api/leaves/apply` as student returns 201 and creates record with `applicantRole: 'student'` on unfixed code
  - Observe: `GET /api/leaves/my` as student returns 200 with only that student's records on unfixed code
  - Observe: `PATCH /api/leaves/:id/status` with valid status updates the record and sets `reviewedBy` on unfixed code
  - Observe: `POST /api/leaves/teacher-apply` as teacher returns 201 on unfixed code
  - Write property-based tests: for all student leave submissions, `applicantRole` is always `'student'` on the created document
  - Write property-based tests: for all student `GET /api/leaves/my` calls, only records matching `req.user._id` are returned
  - Write property-based tests: for random combinations of student/teacher leave records, `getAllLeaves` never returns a teacher-role record
  - Verify all tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for teacher leave access and queue isolation

  - [x] 3.1 Add `applicantRole` field to `LeaveRequest` model
    - Added `applicantRole: { type: String, enum: ['student', 'teacher'], default: 'student' }` to schema in `server/models/LeaveRequest.js`
    - _Bug_Condition: isBugCondition(input) where `GET /api/leaves` returns teacher records due to no role field_
    - _Expected_Behavior: `applicantRole` persisted on every new leave document_
    - _Preservation: Existing records default to `'student'`; no existing queries broken_
    - _Requirements: 2.3_

  - [x] 3.2 Stamp `applicantRole` in `applyLeave` controller
    - Derived `applicantRole` from `req.user.role` and included it in `LeaveRequest.create(...)` in `server/controllers/leaveController.js`
    - _Bug_Condition: isBugCondition(input) where teacher-submitted leaves have no role distinction_
    - _Expected_Behavior: `applicantRole === 'teacher'` for teacher submissions, `'student'` for student submissions_
    - _Preservation: Student apply flow unchanged — still returns 201 with correct record_
    - _Requirements: 2.3, 3.1, 3.4_

  - [x] 3.3 Filter `getAllLeaves` to student-only records
    - Added `applicantRole: 'student'` to the Mongoose query in `getAllLeaves` in `server/controllers/leaveController.js`
    - _Bug_Condition: isBugCondition(input) where `GET /api/leaves` with teacher records in DB returns mixed results_
    - _Expected_Behavior: `getAllLeaves` returns zero records where `applicantRole === 'teacher'`_
    - _Preservation: Student leave records still appear in review queue; status update flow unaffected_
    - _Requirements: 2.2, 2.3, 3.3_

  - [x] 3.4 Open `GET /api/leaves/my` to both student and teacher roles
    - Changed `authorize('student')` to `authorize('student', 'teacher')` on the `/my` route in `server/routes/leaveRoutes.js`
    - _Bug_Condition: isBugCondition(input) where `userRole === 'teacher'` AND `endpoint === 'GET /api/leaves/my'`_
    - _Expected_Behavior: Teacher receives HTTP 200 with only their own leave records_
    - _Preservation: Student `GET /api/leaves/my` continues to return 200 with student's own records_
    - _Requirements: 2.1, 3.2_

  - [x] 3.5 Fix `loadTeacherLeave` in `teacher.html` to call `/api/leaves/my`
    - Replaced `GET /api/leaves` call (with client-side filtering) with direct call to `GET /api/leaves/my` in `client/pages/teacher.html`
    - _Bug_Condition: isBugCondition(input) where teacher frontend fetches all school leaves and filters client-side_
    - _Expected_Behavior: Teacher only receives their own records; no student data exposed to teacher's browser_
    - _Preservation: Teacher leave history display continues to work correctly_
    - _Requirements: 2.1, 2.2_

  - [ ] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Teacher Leave Access and Queue Isolation
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - When these tests pass, it confirms the expected behavior is satisfied
    - Run bug condition exploration tests from step 1
    - **EXPECTED OUTCOME**: Tests PASS (confirms both bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Student and Leave Management Flows
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run the full test suite (exploration + preservation tests)
  - Verify integration flows end-to-end:
    - Teacher submits leave → teacher calls `GET /api/leaves/my` → record appears with HTTP 200
    - Teacher submits leave → admin calls `GET /api/leaves` → teacher leave absent from results
    - Student submits leave → admin calls `GET /api/leaves` → student leave present in results
    - Student calls `GET /api/leaves/my` → only their own records returned (regression check)
  - Ensure all tests pass; ask the user if questions arise.
