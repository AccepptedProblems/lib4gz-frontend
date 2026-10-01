---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# User Dashboard — PRD (Full)

Standalone full-detail PRD. For the short reads, see [`prd-1min.md`](./prd-1min.md) and [`prd-5min.md`](./prd-5min.md).

## 1. Acceptance criteria

### A. Header & welcome

- A1. On load, the page shows `Welcome back, {userName}!` using the name from `AuthService.getUserName()`.
- A2. The search input is rendered top-right on desktop/tablet and full-width on mobile (<768px).
- A3. Search placeholder text is exactly: `Enter course code...`.

### B. Tabs

- B1. *My Courses* and *Teaching* tabs are both present for every authenticated user; the Teaching tab is **not** hidden by role.
- B2. *My Courses* is the default active tab on mount.
- B3. If `enrolledCourses` is empty **and** `createdCourses` is non-empty after the first load, the active tab auto-switches to *Teaching*.
- B4. Active tab is highlighted with the primary color underline.
- B5. *+ Create Course* button is rendered to the right of the tab bar **only** when `activeTab === 'created'` AND `AuthService.hasRole(TEACHER, ADMIN)`.

### C. Course grid

- C1. Each card shows: thumbnail placeholder, title (max 2 lines, ellipsis), instructor name, role badge ("Student" on enrolled tab, "Teacher" on teaching tab), and optional `{moduleCount} modules` chip.
- C2. The student card includes a progress bar element with `aria-valuenow=0`, `aria-valuemin=0`, `aria-valuemax=100` and `0%` text. Real progress wiring is out of scope.
- C3. The grid is `repeat(4, 1fr)` >1200px, `repeat(3, 1fr)` 768–1200px, single column <768px.
- C4. Cards on tablet/desktop use a 4:3 thumbnail; mobile cards use 16:9.
- C5. Cards are focusable (`tabindex=0`), behave as `role="link"`, and Enter or click navigates.
- C6. Clicking a student card navigates to `/course/{id}`. Clicking a teaching card navigates to `/course/{id}/manage`.

### D. States

| State | Trigger | Acceptance |
|---|---|---|
| `loading` | Initial mount, before either list call resolves | 6 skeleton cards rendered in the grid; tab bar visible. |
| `loaded` | Both list calls resolved with data on the active tab | Course grid rendered. |
| `empty` | Active tab list is empty after load | Empty illustration + "No courses yet" + role-specific subtitle ("Enroll in a course…" or "Create your first course"). |
| `error` | Either list call rejects | Error icon, error message text, *Retry* button calling `loadCourses()` again. |

### E. Code search

- E1. Input is debounced 300ms via a Subject pipeline.
- E2. While input is non-empty and any enrolled course's `code.startsWith(input)`, a dropdown of those matches is shown beneath the input.
- E3. Each dropdown row shows `{code}` (monospace) and `{title}` (ellipsis-truncated).
- E4. Click (mousedown) on a row navigates to `/course/{id}` and clears the search.
- E5. Pressing Enter:
  - If exactly one enrolled course's `code === input`, navigate to it.
  - Else if no enrolled match, call `CourseService.getByCode(code)`.
  - On API success and user is enrolled in that course, navigate to it.
  - On API success and user is not enrolled, open the **course preview dialog**.
  - On API 404 (or any error), show inline `Course not found` below the input.
- E6. While `isSearching`, a spinner replaces the clear button on the right side of the input.
- E7. Clear button (`×`) resets `searchCodeInput`, hides the dropdown, clears `searchError`.
- E8. On blur, the dropdown hides after a 150ms delay so a click on a row still registers.

### F. Course preview dialog

- F1. Dialog title is `Apply Course`.
- F2. Body shows course title (centered, `text-title-large`), description (centered, max 4 lines, hidden if absent), and a 3-column meta grid: Instructor / Modules / Students. Missing numeric values render as `—`.
- F3. *Apply* button calls `EnrollmentService.enroll(course.id)`.
  - On success, render an inline success badge ("Your request has been sent successfully."), reload courses, then close the dialog after 1500ms. **Do not** auto-navigate to the course — the request may still be pending instructor approval.
  - On error, show error message inline; keep the dialog open.
- F4. *Cancel* (or backdrop click) closes the dialog and clears `previewCourse`, `applyError`, `applySuccess`.
- F5. The Apply button shows a loading state (`isApplying`) while the request is in flight.

### G. Create course dialog (TEACHER/ADMIN only)

- G1. Dialog opens via *+ Create Course*.
- G2. Form fields: Title (required, `lib-input`), Description (optional, `lib-textarea`, ≥10 rows), Visibility (native `<select>` of `PUBLIC | PRIVATE | UNLISTED`, default `PUBLIC`).
- G3. Submitting an empty title marks the field touched and renders `Title is required`. The form does not call the API.
- G4. On valid submit, `CourseService.create({ title, description: description || null, visibility })` is called.
  - On success, the dialog closes, the form resets, and the user is navigated to `/course/{id}/manage`.
  - On error, an inline error is shown in the dialog body and the dialog stays open.
- G5. Cancel resets the form and closes the dialog.

### H. Accessibility

- H1. Search input has `aria-label="Search course by code"`.
- H2. Tab buttons use `role="tab"` and `aria-selected`.
- H3. Cards expose `role="link"` and an `aria-label` of `Go to course: {title}`.
- H4. Progress bar has `role="progressbar"` and the three `aria-value*` attributes.

## 2. Edge cases

| Case | Expected behavior |
|---|---|
| User in USER role on the Teaching tab | Tab visible, list typically empty → empty state. *+ Create Course* hidden. |
| Both lists empty after load | *My Courses* tab stays active and shows the enrolled empty state. |
| Both list calls error | First error sets `errorMessage` and clears loading; subsequent error is ignored. |
| Code typed matches more than one enrolled course (prefix only) | Dropdown stays open with all matches; Enter does nothing unless exact match. |
| `getByCode` returns a course already in `enrolledCourses` | Skip preview dialog; navigate straight to `/course/{id}`. |
| Apply succeeds but the subsequent `loadCourses` call fails | Success badge has already shown; dialog closes after 1500ms; error from the reload sets the screen-level error state. |
| User clicks the search clear button mid-API-lookup | UI clears; in-flight `getByCode` result is ignored once the user navigates away or types again. |
| Card thumbnail image not yet wired | Placeholder SVG is rendered for every card. |
| `course.moduleCount` is `0` vs. `null` | `0` is rendered as `0 modules`; `null`/`undefined` hides the chip. |
| Long course title (>2 lines) | Truncated with `-webkit-line-clamp: 2`. |
| Instructor name missing | Renders `Instructor:` followed by an empty string — backend is expected to always populate `createdBy.name`. (Open question: should we hide the row?) |

## 3. Error matrix

| Source | Triggered when | UI surface | Recovery |
|---|---|---|---|
| `CourseService.list('enrolled')` rejects | Network down, 401, 500 | Screen-level error state with message + *Retry* button | Retry re-runs `loadCourses()`. 401 should already be handled by the global error interceptor → redirect to `/login`. |
| `CourseService.list('created')` rejects | Same | Same | Same. |
| `CourseService.getByCode` rejects | 404 (typical) or network | Inline `Course not found` under the search input | User edits the input or clears it. |
| `CourseService.create` rejects | 4xx / 5xx | Inline error in the create dialog body | User edits and resubmits. |
| `EnrollmentService.enroll` rejects | 4xx / 5xx | Inline error inside the preview dialog (same slot the success badge would occupy) | User retries or cancels. |

## 4. Analytics (proposed)

The screen is the post-login funnel entry, so we want enough signal to know whether users land here and reach a course.

- `dashboard_viewed` — fired on mount, payload: `{ activeTab, enrolledCount, createdCount }`.
- `dashboard_tab_switched` — payload: `{ from, to }`.
- `dashboard_card_clicked` — payload: `{ courseId, role: 'student' | 'teacher' }`.
- `dashboard_search_submitted` — payload: `{ resultedIn: 'enrolled-nav' | 'preview-dialog' | 'not-found' }`.
- `dashboard_apply_attempted` — payload: `{ courseId, success: boolean }`.
- `dashboard_create_course_attempted` — payload: `{ visibility, success: boolean }`.

Concrete event names and a tracking provider are TBD — see `design-full.md` open questions.
