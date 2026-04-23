# Bugfix Requirements Document

## Introduction

Leave requests are broken for teachers in the school management application. Two related bugs exist:

1. Teachers cannot view their own leave history — the `/api/leaves/my` endpoint is restricted to students only, returning a 403 for teachers. The frontend workaround fetches all school leave records and filters client-side, which exposes all student leave data to the teacher unnecessarily.

2. Teacher-submitted leave applications appear in the "Student Requests" tab — because the `LeaveRequest` model stores the applicant in a `student` field regardless of role, and `getAllLeaves` returns all leaves without distinguishing applicant role. This causes teacher leave entries to show up alongside student leave requests, polluting the review queue.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a teacher requests `GET /api/leaves/my` THEN the system returns a 403 Access Denied error because the route is restricted to the `student` role only

1.2 WHEN a teacher submits a leave application via `POST /api/leaves/teacher-apply` and then views the "Student Requests" tab THEN the system displays the teacher's own leave entry mixed in with student leave requests

1.3 WHEN an admin or teacher calls `GET /api/leaves` THEN the system returns all leave records for the school including teacher-submitted leaves, with no way to distinguish them from student leaves

### Expected Behavior (Correct)

2.1 WHEN a teacher requests their own leave history THEN the system SHALL return only that teacher's leave applications with a 200 response

2.2 WHEN a teacher views the "Student Requests" tab THEN the system SHALL display only leave requests submitted by students, excluding any teacher-submitted leave applications

2.3 WHEN an admin or teacher calls `GET /api/leaves` THEN the system SHALL return only student leave requests, or SHALL provide a means to filter by applicant role so teacher and student leaves are not mixed

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a student submits a leave application via `POST /api/leaves/apply` THEN the system SHALL CONTINUE TO create the leave record and return a 201 response

3.2 WHEN a student requests `GET /api/leaves/my` THEN the system SHALL CONTINUE TO return only that student's own leave history

3.3 WHEN an admin or teacher approves or rejects a student leave request via `PATCH /api/leaves/:id/status` THEN the system SHALL CONTINUE TO update the leave status and return the updated record

3.4 WHEN a teacher submits a leave application via `POST /api/leaves/teacher-apply` THEN the system SHALL CONTINUE TO create the leave record successfully
