---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Course Management — PRD (5-min)

## Problem

Teachers managing a course were jumping between three pages: a tabbed management view for content, a separate `/manage/enrollments` table, and a `/manage/requests` queue for approvals. The course title vanished from the viewport when tabs scrolled, and pending enrollments were invisible unless a teacher actively opened the requests page.

## Primary user

Course **teacher/owner**. Access is enforced by `authGuard` + `roleGuard` with `roles: [teacher]`. Learners landing on `/course/:id/manage` are bounced back to the student dashboard.

## Outcome

One hub at `/course/:id/manage`. Persistent 280px left sidebar holds course identity (name, description, Edit, Go to Course). A vertical nav switches the centered content (max-width 960px) between **Course Material** and **Enrollment**. Pending enrollment count surfaces as a red badge on the Enrollment item.

## User stories

- *As a teacher,* I see the course name and description while I edit content, so I always know which course I'm editing.
- *As a teacher,* I can add, rename, reorder, and delete modules and lessons inline, without modals when possible.
- *As a teacher,* I click a lesson to open its detail (title, summary, exercises) without losing my place in the module tree.
- *As a teacher,* I see how many enrollment requests are pending the moment I land on the screen.
- *As a teacher,* I can approve or reject a pending enrollment in one click from the same screen where I edit content.
- *As a teacher,* I can navigate to the student-facing course view to sanity-check the published experience.

## Scope

**In**
- Two-column layout (sidebar + centered content), responsive drawer below 768px.
- Sidebar: course title, description (3-line clamp), Edit + Go to Course actions, nav items for Course Material and Enrollment.
- Course Material view: module/lesson accordion, inline CRUD, click-through to lesson detail (rendered by `app-lesson-detail-management`).
- Enrollment view: rendered by `app-enrollment-management` (search, status chips, table, approve/reject/role/remove).
- Computed `pendingEnrollmentCount` drives the red sidebar badge.
- Optimistic updates for add/rename/delete with toast feedback.

**Out**
- Summary editor (separate spec, TODO at `/course/:id/manage/lesson/:lessonId/summary/edit`).
- Exercise editor (separate screens at `/course/:id/manage/exercise/new` and `/edit`).
- Course creation, course soft-delete UI, drag-drop reordering UI (API supports it; surface is deferred).
- Bulk actions on enrollments.

## Key assumptions

- A teacher can fit the module list and the lesson detail in their working memory; we don't need a persistent breadcrumb beyond the back arrow + module badge.
- Enrollment counts in this product stay below ~500 per course; client-side filter/pagination is adequate.
- Summary content is edited inline in the lesson detail child component (textarea); no rich-text editor is required for v1 of this hub.

## Risks & dependencies

- **Sidebar visual regression.** Unified Surface principle is easy to violate; a stray `background-color` or `border-right` ships looks like a bug. Enforce via design review and CSS lint.
- **Lazy lesson loading.** Lessons load per-module on first accordion expand; if `forkJoin` patterns shift, latency on first expand may spike.
- **Pending badge staleness.** If a teacher never re-enters the screen, the badge can lag. We rely on entry-time fetch — no polling in v1.
- **Depends on:** `CourseService`, `ModuleService`, `LessonService`, `ExerciseService`, `SummaryService`, `EnrollmentService`; child components `app-lesson-detail-management` and `app-enrollment-management`; shared `lib-button`, `lib-badge`, `lib-input`, `lib-dialog`, `lib-skeleton`, `lib-spinner`, `lib-toast`, `lib-chip`, `lib-textarea`.

[1-min](./prd-1min.md) · [Full](./prd-full.md) · [Tech design](./design-5min.md)
