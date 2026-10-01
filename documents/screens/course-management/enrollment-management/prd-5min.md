---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Enrollment Management — PRD (5-min)

> Inline view of [Course Management](../prd-5min.md). Read the parent for screen-level layout and access control.

## Problem

Triaging enrollment requests was split across two routes (`/manage/enrollments` for the full list, `/manage/requests` for the pending queue). Teachers had to remember to visit the second one; pending requests sat unnoticed. Both routes also lived outside the course-management hub, so context-switching cost was high.

## Primary user

Course **teacher**, already inside `app-course-management`, who clicks the Enrollment nav item. The parent passes the full enrollments array as an input; this child handles all filtering, pagination, and per-row actions.

## Outcome

A single inline view rendered by `app-enrollment-management`. One table with: compact search input (max-width 320px), inline chip-based status filter with a pending count badge, role-colored badges (TEACHER = primary, LEARNER = neutral), and per-row actions that adapt to the row's status. Approve/Reject for `PENDING` rows; Toggle Role + Remove (both with confirmation dialogs) for everything else. Pagination at 20 per page.

## User stories

- *As a teacher,* I see all my course's enrollments in one table without bouncing between pages.
- *As a teacher,* I see the pending request count on the chip filter and on the parent's sidebar — never lose track.
- *As a teacher,* I can search by name or email to find a specific student.
- *As a teacher,* I can filter to PENDING in one click.
- *As a teacher,* I can approve or reject a pending request in one click.
- *As a teacher,* I can promote a learner to a co-teacher (or demote) with explicit confirmation.
- *As a teacher,* I can remove a student from the course with explicit confirmation.

## Scope

**In**
- Inputs: `enrollments: EnrollmentResponse[]` (full list from parent).
- Outputs: `enrollmentUpdated: EnrollmentResponse`, `enrollmentRemoved: string`.
- Internal `search`, `statusFilter`, `page` signals; computed `filteredEnrollments`, `paginatedEnrollments`, `totalPages`, `pendingRequestCount`.
- Approve, reject, update (role), delete via `EnrollmentService`. Each mutation emits up so the parent reconciles.
- Two confirmation dialogs: role-change and remove.
- Empty-state copy that differs between "no data yet" and "no match for current filter".
- Mobile: hide email column.

**Out**
- Bulk select / bulk approve.
- Server-side filtering or pagination (current scale is small enough for client-side).
- Invite-by-email flow.
- CSV export of the roster.
- A standalone screen route — this view exists only inside the parent.

## Key assumptions

- Course rosters fit comfortably in memory (low hundreds of rows). If this grows, server-side filtering becomes necessary.
- Parent owns the enrollments source of truth and reacts to `enrollmentUpdated` / `enrollmentRemoved` to keep its sidebar pending count fresh.
- Role toggle is binary (LEARNER ⇄ TEACHER); no third role in v1.

## Risks & dependencies

- **Stale parent list after mutation.** If the parent doesn't reconcile on `enrollmentUpdated` / `enrollmentRemoved`, the table and the sidebar pending badge drift. Documented as the parent's responsibility.
- **Accidental role promotion.** Mitigated by mandatory confirmation dialog showing target role + user name.
- **Removal is irreversible.** Backend hard-deletes the enrollment; we only warn. Could be a soft-delete in the future.
- **Depends on:** `EnrollmentService`, `ToastService`, shared `lib-button`, `lib-badge`, `lib-chip`, `lib-dialog`, Angular `DatePipe`.

[1-min](./prd-1min.md) · [Full](./prd-full.md) · [Tech design](./design-5min.md) · [Parent screen](../prd-5min.md)
