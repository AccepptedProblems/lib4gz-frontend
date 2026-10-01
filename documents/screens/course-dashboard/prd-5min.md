---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Course Dashboard — PRD (5 min)

> Standalone. Expands [prd-1min.md](./prd-1min.md). For acceptance criteria and edge cases see [prd-full.md](./prd-full.md).

## Problem

Today a student opening `/course/:id` lands on a flat page that mixes course identity with content; switching lessons reloads the whole view, and teachers have no in-place way to compare how each student answered a particular question. The screen also doesn't anchor the user — a student deep in module 4 can lose context for which course they're in.

## Primary user & beneficiaries

- **Student (LEARNER, enrolled).** Wants to read a lesson, do its exercises, see what's next.
- **Teacher (TEACHER, enrolled).** Wants the student view plus a per-question view of all student answers for grading/feedback.
- **Unenrolled visitor.** Sees course identity but content is locked behind an "Enroll Now" CTA.

## Outcome

A persistent left sidebar (280 px) holds course name, description, instructor, optional **Manage Course** button, and a collapsible module → lesson tree. The right column is the content area (max-width 900 px, left-aligned) and switches lesson content via a Summary / Exercises / Submissions tab bar without leaving the route. Teachers get a Submissions tab that drills exercise → question → all-students'-answers via a right-side `MatDrawer` that shrinks the content rather than overlaying it.

## Success metric

- p75 lesson switch latency ≤ 500 ms after first load.
- ≥ 80 % of in-session lesson navigation uses sidebar clicks.
- Teacher Submissions tab: ≤ 3 clicks from "I want to see how everyone answered Q3" to seeing it.

## User stories

| ID | Role | Story |
|---|---|---|
| US-1 | Student | I open a course and see its title, description, and instructor without scrolling. |
| US-2 | Student | I click a lesson in the sidebar and read its summary in the same view. |
| US-3 | Student | I switch to **Exercises** and see, per exercise, my current attempt status (Not attempted / Draft / Submitted / Approved / Needs Revision). |
| US-4 | Student | I click **Do Exercise** and land on the attempt screen for this lesson. |
| US-5 | Teacher | I see a **Manage Course** button in the sidebar that takes me to `/course/:id/manage`. |
| US-6 | Teacher | I open **Submissions**, expand an exercise, click a question, and see every student's answer for that question side-by-side without losing the lesson view. |
| US-7 | Visitor | I land on a course I'm not enrolled in, see the course identity in the sidebar, and a clear **Enroll Now** CTA in the content area; lesson content is locked. |
| US-8 | Mobile user | The sidebar collapses into a drawer behind a hamburger; the content fills the screen but never touches the viewport edge. |

## Scope

**In scope**
- Two-column desktop layout, single-column + drawer on mobile.
- Sidebar: course identity, optional Manage button, divider, "Course Material" header, accordion of modules with hierarchical numbering (`1.`, `1.1`).
- Content tabs: Summary, Exercises, Submissions (teacher only).
- Auto-select first lesson of first module on load.
- Enrollment-state gating (ACTIVE / PENDING / REJECTED / null) with badge + content lock for non-ACTIVE.
- Right-side `MatDrawer` (mode="side") for per-question student answers.
- Plain-text URL auto-linkify in summary content.

**Out of scope (this iteration)**
- Lesson completion / progress tracking.
- Search across modules or lessons.
- Reordering / editing modules and lessons (lives under `/manage`).
- Inline grading actions in the drawer (read-only view).
- Multi-question selection or bulk export of answers.
- Notifications / unread indicators per lesson.

## Key assumptions

- Backend returns enrollment role on `GET /v1/courses/{id}/my-enrollment`; `404` means not enrolled.
- Module list and per-module lesson list are small enough that a per-module fetch on first expand is acceptable (no pagination).
- `SummaryService.get` returns `404` when no summary exists — treated as a state, not an error.
- Teacher count of students per exercise is small enough that fetching every submission with answers via parallel `forkJoin` is acceptable for v1; will be reconsidered if a class has > ~50 submissions per exercise.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `forkJoin` over many submissions for a teacher's drawer is slow | Med | Med | Cap parallelism / lazy-load on drawer open only; add server-side endpoint that returns submissions with answers if the issue surfaces. |
| Sidebar visual treatment drifts toward a "panel" with bg/border, violating Unified Surface | High | Med | Hard rule in `documents/design-system/design-principles.yaml`; flagged as a code-review checklist item. |
| Hierarchical numbering desyncs from `orderIndex` after edits | Low | Low | Numbering is purely positional from the sorted `@for` `$index` — never persisted. |
| Mobile drawer loses focus management | Med | Low | Use `aria-expanded` + focus trap; covered in acceptance criteria. |

## Dependencies

- Backend endpoints: `courses.get`, `modules.list-by-course`, `enrollments.my-enrollment`, `lessons.list-by-module`, `summaries.get`, `exercises.list-by-lesson`, `submissions.my-submission`, `submissions.list-by-exercise`, `submissions.get`, `questions.list-by-exercise`, `enrollments.enroll`. See [contract.yaml](./contract.yaml) → `related_docs.api_endpoints`.
- Shared components: `lib-button`, `lib-badge`, `lib-chip`, `lib-skeleton`, `lib-spinner`, `LinkifyPipe`, `MatDrawer` (Angular Material).
- Auth: parent route `course/:id` applies `authGuard`; teacher-only UI is conditional on `myEnrollment().role === TEACHER` — not on `roleGuard`, because the same screen serves both roles.
