---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Course Dashboard — PRD (full)

> Standalone. The 1-min and 5-min versions live alongside this file. This document is the implementer's reference: every story has acceptance criteria, edge cases, and analytics.

## 1. Context

`/course/:id` is the primary working surface inside a course. It serves both LEARNER and TEACHER roles for the same course; role-specific affordances are conditional, not gated by separate routes. The screen status is **scaffold** — the layout is in place but several states (not-enrolled gating, mobile drawer focus management, retry on error) are not yet fully wired.

## 2. User stories with acceptance criteria

### US-1 — Course identity always visible

**As a student, I see course title, description (truncated to ~3 lines), and instructor name in the sidebar without scrolling.**

- AC-1.1: Sidebar shows `course.title` (text-title-large), `course.description` clamped at 3 lines, and `course.createdBy.name` (instructor) in the primary color.
- AC-1.2: When `course.description` is null, the description line is omitted (not rendered as an empty paragraph).
- AC-1.3: On viewports ≥ 768 px, the sidebar is fixed at 280 px and the course identity remains visible while content scrolls.

### US-2 — Lesson selection without route change

**Clicking a lesson loads its content into the right column.**

- AC-2.1: Clicking a lesson item sets the in-component `selectedLesson` signal and updates the visible content; the URL stays at `/course/:id`.
- AC-2.2: `activeTab` resets to `'summary'` whenever the selected lesson changes.
- AC-2.3: The first module auto-expands on initial load and the first lesson of the first module auto-selects.
- AC-2.4: The selected lesson item has a left accent border (3 px, primary-600), `aria-current="true"`, and a soft tinted background (`primary-color-50`).
- AC-2.5: Hierarchical numbering — module headers display `{i+1}. {title}`, lesson items display `{i+1}.{j+1} {title}`. Numbers come from sorted `@for` indices, never the data.

### US-3 — Exercise status at a glance

**The Exercises tab shows my current attempt status per exercise.**

- AC-3.1: Tab label includes the count when exercises exist (`Exercises (3)`); plain `Exercises` when zero.
- AC-3.2: Each exercise card shows `Exercise {n}: {title}`, type label + question count, and a status chip mapped from `SubmissionService.getMySubmission(exerciseId)`.
- AC-3.3: Status mapping: `404` → "Not attempted" (neutral), `DRAFT` → "Draft" (neutral), `SUBMITTED` → "Submitted" (primary), `APPROVED` → "Approved" (success), `NEEDS_REVISION` → "Needs Revision" (warning).
- AC-3.4: A single **Do Exercise** button at the bottom of the tab is shown when `exercises().length > 0` and navigates to `/course/:id/lesson/:lessonId/attempt`.
- AC-3.5: Tab data is fetched only on first activation per lesson; switching back to the tab does not re-fetch.

### US-5 — Teacher sidebar affordance

**As a teacher, I see a Manage Course button in the sidebar.**

- AC-5.1: Button is rendered iff `myEnrollment()?.role === EnrollmentRole.TEACHER`.
- AC-5.2: Click navigates to `/course/:id/manage`.
- AC-5.3: For non-teachers, the button is removed from the DOM (not just `display:none`) so it is absent from the accessibility tree.

### US-6 — Per-question answers drawer (teacher)

**As a teacher, I drill exercise → question → all students' answers for that question.**

- AC-6.1: **Submissions** tab is rendered iff `isTeacher()`.
- AC-6.2: Each exercise card in Submissions is expandable; only one card may be expanded at a time. Expanding a second collapses the first and closes the drawer if open.
- AC-6.3: First expand fetches `QuestionService.listByExercise(exerciseId)` and caches the result in `exerciseQuestions: Map<string, QuestionResponse[]>`.
- AC-6.4: Clicking a question opens a right-side `MatDrawer` (mode="side", position="end", 520 px desktop / 100 vw mobile). The content area shrinks to fit alongside the drawer; there is no overlay backdrop.
- AC-6.5: Drawer body lists one card per submission for that exercise. Each card shows student name, status chip, and either the matched answer text (`sub.answers.find(a => a.questionId === drawerQuestionId).answer`) or `(no answer)` italic placeholder.
- AC-6.6: Closing the drawer (close button or programmatic) clears `drawerQuestionId`, `drawerExerciseId`, `drawerSubmissions`.
- AC-6.7: The drawer is read-only — no grading or messaging actions.

### US-7 — Not-enrolled CTA

**An unenrolled visitor sees course identity but locked content.**

- AC-7.1: Sidebar still renders course identity (no Manage button).
- AC-7.2: Content area shows an **Enroll Now** primary CTA button (`lib-button variant="primary" size="lg"`) and a short description.
- AC-7.3: Clicking the CTA calls `EnrollmentService.enroll(courseId)`. On success, refresh `myEnrollment` and unlock content. On error, surface an inline error message with retry.
- AC-7.4: For `PENDING` or `REJECTED` enrollment, content is locked at `opacity: var(--opacity-disabled)` and the appropriate badge shows in the sidebar.

### US-8 — Mobile

- AC-8.1: At < 768 px, the sidebar is removed from flow and replaced by a slide-in drawer with explicit `--surface-page` (#ffffff) background and `--shadow-lg`.
- AC-8.2: Toggle is a 40 × 40 px icon-only hamburger button (Material Icons "menu") at the top-left of the content flow. No background or border at rest; hover uses `--surface-hover`.
- AC-8.3: Drawer closes on backdrop click or X button; focus returns to the toggle button.
- AC-8.4: Content padding is 16 px at < 768 px, 24 px / 32 px at ≥ 768 px. Content never touches the viewport edge at any width.

## 3. Cross-cutting acceptance criteria

- **Unified Surface (hard rule).** Sidebar shares the content's white background. No `background-color` and no `border-right` / `border-left` on sidebar elements. Separation comes from negative space only. (See `documents/design-system/design-principles.yaml`.)
- **Explicit text colors.** Native `<button>` elements (module headers, lesson items, tab buttons) must set `color: var(--text-primary-color, #1a1a1a)` because color is not reliably inherited.
- **Linkify summaries.** Summary HTML is piped through `LinkifyPipe`; URLs become `<a target="_blank" rel="noopener noreferrer">` styled with primary color and underline.
- **Lazy fetching.** Per-module lessons fetch only on first expand. Per-exercise submission status fetches only when the Exercises tab activates. Per-question answers fetch only when the drawer opens.
- **Accessibility.** Module accordion uses `aria-expanded` + `aria-controls`. Selected lesson uses `aria-current="true"`. Lesson content area is `aria-live="polite"`.

## 4. Edge cases

| Case | Expected behavior |
|---|---|
| Course has zero modules | Sidebar shows course identity + "No modules yet" placeholder under "Course Material". Content area shows the "Select a lesson" prompt. |
| Module has zero lessons | Module row is still rendered and expandable but reveals "No lessons yet" inside. |
| Lesson has no summary | Summary tab shows "No summary available for this lesson." (no error). |
| Lesson has no exercises | Exercises tab label is "Exercises" (no count); body shows "No exercises available for this lesson." The **Do Exercise** button is hidden. |
| Teacher viewing a lesson with zero exercises | Submissions tab body shows the same "No exercises available" placeholder. |
| `getMySubmission` returns 404 for an exercise | Render "Not attempted" chip; do **not** surface as an error. |
| `EnrollmentService.getMyEnrollment` returns 404 | Treat as not-enrolled (`null`); render the not-enrolled state. |
| Network failure on initial load (course/modules/enrollment) | Page-level error state with a Retry button. |
| Network failure on a per-lesson summary fetch | "Failed to load summary." inline placeholder; do not block other tabs. |
| User changes lesson while a per-exercise submission fetch is in flight | The in-flight result is discarded (selection signal change supersedes). |
| User opens drawer, then collapses the parent exercise card | Drawer auto-closes via the same `expandedExerciseId` change. |
| Enrollment state is PENDING | Sidebar badge "Pending Approval" (warning); content is dimmed (`--opacity-disabled`); lessons are not clickable. |
| Mobile drawer open + viewport resized to ≥ 768 px | Drawer state resets; desktop sidebar takes over. |

## 5. Error states

| Surface | Trigger | UI |
|---|---|---|
| Whole page | Course or modules fetch fails on init | Centered error + Retry button. |
| Sidebar lesson list | Per-module lessons fetch fails | Inline "Couldn't load lessons" with a small retry icon under the module. |
| Summary tab | `summaries.get` non-404 error | "Failed to load summary." placeholder. |
| Exercises tab | `exercises.list-by-lesson` fails | "Couldn't load exercises." with retry. |
| Submissions tab | `submissions.list-by-exercise` fails | Same pattern, per exercise card. |
| Drawer | `submissions.get` (forkJoin) partially fails | Show partial results; surface a small "Some answers couldn't be loaded" banner inside the drawer. |
| Enroll CTA | `enrollments.enroll` fails | Inline error under the button; CTA stays clickable for retry. |

## 6. Analytics (proposed; not yet wired)

| Event | When | Properties |
|---|---|---|
| `course_dashboard_opened` | Component init after course + enrollment loaded | `courseId`, `role`, `enrollmentStatus` |
| `lesson_selected` | Lesson click in sidebar | `courseId`, `lessonId`, `moduleIndex`, `lessonIndex` |
| `tab_switched` | Tab click | `tabId`, `lessonId` |
| `do_exercise_clicked` | Exercises tab CTA | `lessonId`, `exerciseCount` |
| `manage_course_clicked` | Sidebar button | `courseId` |
| `submissions_question_opened` | Drawer open | `exerciseId`, `questionId`, `submissionCount` |
| `enroll_clicked` | Not-enrolled CTA | `courseId`, `outcome` (success / error) |
| `mobile_sidebar_toggled` | Hamburger click | `state` (open / close) |

Owner of analytics wiring: TBD.
