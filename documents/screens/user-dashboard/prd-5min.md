---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# User Dashboard — PRD (5 min)

The first authenticated screen. Both students and teachers land here at `/` after login.

## Problem & outcome

| | |
|---|---|
| **Today** | Users complete login and are dropped onto an empty home with no path to their work. Teachers also have no entry point to create a new course. |
| **After this ships** | Users see their enrolled courses immediately. Teachers see courses they own and can create new ones. Anyone with a course code can find and apply to a course they are not yet in. |

## Primary user

- **Student.** Logs in, wants to resume the course they were in.
- **Teacher / admin.** Logs in, wants to manage existing courses or start a new one.
- **New enrollee.** Has a course code from an instructor, wants to apply.

## User stories (in scope)

1. As a logged-in user, I see "Welcome back, {name}!" so I know I am signed in.
2. As a student, I see my enrolled courses as cards so I can pick one and resume.
3. As a teacher, I switch to the *Teaching* tab and see courses I own.
4. As a teacher/admin, I click *+ Create Course* on the Teaching tab, fill in title/description/visibility, and land on the new course's manage page.
5. As any user with a code, I type the code into the top-right search and either jump to the course (if enrolled) or open a preview-and-apply dialog (if not).
6. As any user, I see clear empty, loading, and error states — never a blank screen.
7. As a keyboard user, I can tab through cards and activate them with Enter.

## Scope

**In scope (this iteration)**

- Tabbed list of enrolled vs. taught courses.
- Course cards with thumbnail placeholder, title, instructor, role badge.
- Responsive grid: 4 cols >1200px, 3 cols 768–1200px, 1 col <768px.
- Code-based search with dropdown of enrolled matches and `getByCode` fallback.
- Course preview + apply (enrollment) dialog.
- Create-course dialog (TEACHER/ADMIN only).
- Loading skeletons, empty state, error state, retry.

**Out of scope (this iteration, not "never")**

- Real course progress percentage — placeholder shows `0%`.
- Real thumbnails — placeholder icon only.
- Last-activity timestamp on cards (mentioned in early sketch, deferred).
- Sorting controls — server returns whatever order it returns.
- Pagination — assumed list size fits in one page.
- Tab badge counts as a designed feature (current code shows raw counts; this is incidental, not a requirement).

## Key assumptions

- The user has a valid JWT (enforced by `authGuard` on `/`).
- The backend's `CourseService.list(type)` returns enrolled/created courses for the authenticated user; no extra filter params needed.
- `code` is unique across the system and stable for the lifetime of a course.
- Enrollment requests succeed silently (no instructor-approval flow inside this screen — applying is a one-step action from the user's perspective).

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Two parallel `list()` calls (enrolled + created) on every dashboard mount | Slow time-to-interactive on cold cache | Show skeletons; don't block UI on the second call. |
| User in USER role lands on Teaching tab and sees zero courses | Confusing dead-end | Default tab logic falls back to whichever has results. |
| `getByCode` 404 leaks technical-sounding error | Poor UX | Catch-all → render literal "Course not found" inline. |
| Apply succeeds but course list reload races dialog close | Flicker / stale list | Reload before closing; close after a short delay. |

## Dependencies

- `CourseService.list / create / getByCode` — see [`network/api-endpoints.yaml#/resources/courses`](../../network/api-endpoints.yaml).
- `EnrollmentService.enroll` — see [`network/api-endpoints.yaml#/resources/enrollments`](../../network/api-endpoints.yaml).
- `AuthService.hasRole`, `AuthService.getUserName`.
- Shared components: `lib-button`, `lib-dialog`, `lib-input`, `lib-textarea`.
- Design system tokens (colors, typography, breakpoints).
