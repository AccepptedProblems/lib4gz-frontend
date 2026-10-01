---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Course Management — Tech Design (1-min)

- **What we're building.** A teacher-only management hub at `/course/:id/manage` rendered by `app-course-management`, with a 280px sidebar and a centered content slot that swaps between two child-rendered views: Course Material and Enrollment.
- **Key decision: sidebar nav over tabs.** Persistent course identity must remain visible while editing; tabs pushed it out of the viewport. Sidebar gives stable identity, room for badges (pending enrollments), and matches the student `course-dashboard` layout for visual continuity.
- **Key decision: fold enrollment + requests into one inline view.** Replaces previously deprecated routes `/manage/enrollments` and `/manage/requests` (see `documents/_archive/enrollment-management/`, `documents/_archive/enrollment-requests/`). One table with chip filters and a pending-count badge is faster than two routes.
- **Alternatives rejected.**
  - *Top tabs:* loses identity on scroll; nowhere to surface badge counts naturally.
  - *Two separate routes for enrollment vs requests:* extra navigation; pending requests easy to forget.
  - *Modal-driven CRUD:* breaks flow for inline structural edits (module/lesson rename).
- **Risk summary.** Three: (1) Unified Surface regressions (stray sidebar background or border), (2) lazy-load latency on first module expand if `forkJoin` shape changes, (3) child component contracts (`lesson-detail-management`, `enrollment-management`) drift from parent expectations.
- **Code lives at.** `src/app/components/course-teacher/course-management/` with sub-folders for the two child components.

[5-min](./design-5min.md) · [Full](./design-full.md) · [Contract](./contract.yaml) · [PRD](./prd-1min.md)
