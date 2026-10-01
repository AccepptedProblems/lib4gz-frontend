---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Course Management — PRD (Full)

> Inherits problem statement, users, and scope from [prd-5min.md](./prd-5min.md). This doc focuses on acceptance criteria, edge cases, and analytics.

## Acceptance criteria

### Layout & sidebar

- Two-column layout above 768px: 280px fixed sidebar on the left, centered content (max-width 960px, left-aligned) on the right.
- Sidebar and content area share the same white background. **No background-color, no border-right** between them. Separation is purely whitespace (padding-right on sidebar).
- Sidebar shows: course name (`text-title-large`), description with 3-line clamp (`text-body-medium`, secondary color), and an actions row with **Edit** and **Go to Course** buttons (both `lib-button variant="secondary" size="sm"`).
- Sidebar nav lists two items: **Course Material** (icon `menu_book`) and **Enrollment** (icon `group`).
- Nav items show **no item counts**. Only the Enrollment item shows a red pill badge (red bg, white text, `var(--radius-full)`) when `pendingEnrollmentCount() > 0`.
- Active nav item has a 3px left accent border using `--primary-color-600` and primary-color text.
- Below 768px: sidebar collapses to a slide-in drawer with `--surface-page` background. A 40×40px icon-only hamburger button (no fill, no border) sits at the top-left of content. Drawer dismisses on backdrop click or X.
- Content area always has padding (24px 32px desktop, 16px mobile). Content never touches the viewport edge.

### View switching

- `activeView` signal of type `'course-material' | 'enrollment'`. Default: `course-material`.
- Clicking a nav item updates `activeView` and re-renders the content slot. View state is preserved across switches (not destroyed).

### Course Material — Module list (default sub-view)

- Modules render as collapsible accordion sections, sorted by `orderIndex`.
- First module is expanded on load; others collapsed. Expanding a module does **not** collapse others.
- On first expand of a module, lessons are fetched via `LessonService.listByModule(moduleId)`.
- Each module header shows title (with `orderIndex + 1` prefix, e.g., `Module 1: Introduction`) plus Edit and Delete actions.
- Lesson rows show a numbered prefix `moduleIndex.lessonIndex` (e.g., `1.1`, `1.2`) followed by the title — no tree icon. Click on the title enters the lesson detail sub-view.
- Each lesson row has Edit (enters lesson detail editing) and Delete actions.
- "+ Add Module" button at the bottom of the module list. "+ Add Lesson" button at the bottom of each module's lesson list.
- Inline add/edit forms: an input plus Save (`primary sm`) and Cancel (`secondary sm`) buttons. Enter submits, Escape cancels.
- Delete confirmation dialog (`lib-dialog`) per entity, with cascade warning text:
  - Module: "This will also delete all lessons and exercises in this module."
  - Lesson: "This will also delete the lesson summary and any linked exercises."
- Empty state: "No modules yet. Create your first module to start building your course." with a CTA Add Module button.

### Course Material — Lesson detail (sub-view)

- Sub-view managed by `materialSubView` signal of type `'module-list' | 'lesson-detail'`.
- Entered when a lesson title is clicked. Sets `selectedLessonContext` and renders `app-lesson-detail-management` (see [lesson-detail-management](./lesson-detail-management/prd-1min.md)).
- Back button (icon-only `arrow_back`, `.icon-btn`) returns to module list and clears the selection.
- Inputs: `courseId`, `lesson`, `moduleTitle`. Outputs: `back`, `lessonUpdated`, `exerciseDeleted`. Parent reconciles its module/lesson signal on `lessonUpdated`.

### Enrollment view

- Rendered by `app-enrollment-management` (see [enrollment-management](./enrollment-management/prd-1min.md)).
- Receives `enrollments` array; emits `enrollmentUpdated` and `enrollmentRemoved`.
- Parent's `pendingEnrollmentCount` is a `computed()` that derives the count from the enrollments array, so the sidebar badge updates the moment the child emits an approval/rejection.

### Data loading

- On init, parent fetches in parallel via `forkJoin`:
  - `CourseService.get(id)`
  - `ModuleService.listByCourse(id)`
  - `EnrollmentService.listByCourse(id)`
- Lessons are lazy-loaded per module on first accordion expand.
- Summary + exercises are loaded by `app-lesson-detail-management` on lesson input change (effect-based).
- Course id is read from the parent route: `inject(ActivatedRoute).parent?.paramMap` or `route.paramMap`.

### Edits

- Course title and description: inline edit toggle in the sidebar (or modal — implementer's call provided UX matches Unified Surface). Save calls `CourseService.update(id, { title, description })`.
- Module CRUD: `ModuleService.create | update | delete`.
- Lesson CRUD: `LessonService.create | update | delete`.
- Optimistic updates apply to: add module, rename module/lesson, delete module/lesson/exercise. Rollback + error toast on failure.

## Edge cases

- **Course not found / 404.** Show error state with retry. After retry exhausted, link back to dashboard.
- **Forbidden (not a teacher of this course).** `roleGuard` rejects before render; redirect to `/course/:id`.
- **No modules.** Empty state with primary CTA. Module accordion is replaced by the empty illustration block.
- **Module with no lessons after expand.** Show inline "+ Add Lesson" only — no error.
- **Lesson with no summary.** Lesson detail shows "No summary yet." placeholder. Edit button reveals an empty textarea (handled by child).
- **Lesson with no exercises.** "No exercises yet for this lesson." empty row; Add Exercise CTA still visible.
- **Pending count is zero.** Badge is hidden entirely (not rendered as `0`).
- **API error during a CRUD action.** Optimistic state rolls back; error toast appears with the action verb (e.g., "Failed to delete module"). The user retains the dialog/form they were in.
- **Concurrent edit conflict.** Out of scope for v1; last-write-wins. Backend versioning is on the roadmap.
- **Mobile + drawer open + nav click.** Selecting a nav item closes the drawer and switches the view in one motion.
- **Deep-link to lesson detail.** Not supported in v1 — only `materialSubView='module-list'` is the entry. Direct URLs to a lesson are reserved for a future iteration.

## Error states

- **Initial load failure.** Full-screen error block with a retry button that re-runs the `forkJoin` initial fetch.
- **Mutation failure.** Toast (`lib-toast` error variant), no full-screen error, the user can continue.
- **Lesson detail fetch failure.** Lesson detail shows an inline error block with retry; back button still works.

## Accessibility

- Sidebar nav uses `role="navigation"` + `aria-label="Course management"`.
- Active nav item exposes `aria-current="page"`.
- Module accordion headers expose `aria-expanded`/`aria-controls`.
- Tables expose `<th scope="col">` headers.
- Dialogs are modal with focus trap + `aria-modal="true"`. Focus returns to the trigger on close.
- Inline edit inputs receive focus on activation; Escape cancels.
- Action buttons (Approve/Reject/Delete) use `aria-label` that includes the entity name.
- Mobile drawer traps focus and is dismissible by Esc.

## Analytics (target events)

- `course_management.viewed` — on screen entry, with `course_id`, `pending_count`.
- `course_management.view_switched` — on nav item click, with `from`, `to`.
- `course_management.module_added | module_renamed | module_deleted`.
- `course_management.lesson_added | lesson_renamed | lesson_deleted`.
- `course_management.lesson_detail_entered | exited`.
- `course_management.enrollment_approved | rejected | role_changed | removed`.

(Events are aspirational — they are not yet wired.)

## Wireframes

ASCII wireframes for each view are kept in [design-full.md](./design-full.md). Figma file: TBD.

[1-min](./prd-1min.md) · [5-min](./prd-5min.md) · [Tech design](./design-full.md)
