---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Lesson View — PRD (full)

## 1. Problem & user
See [prd-5min](./prd-5min.md). Repeated only where it grounds an acceptance criterion below.

## 2. Acceptance criteria

### AC1 — Header & position
- Header shows a back link "← Back to Course" that navigates to `/course/:courseId`.
- Header shows "Lesson X of Y" where X is the 1-indexed position of `lessonId` in the flattened module → lesson list, Y is the total lesson count for the course.
- If `lessonId` is not in the course, show the **not-found** state (AC8).

### AC2 — Title and type badge
- Lesson title renders at `text-headline-medium`.
- A type badge renders directly above the title with the label and color from this table:

| Type     | Label    | Color  |
|----------|----------|--------|
| Summary  | Reading  | Blue   |
| Video    | Video    | Purple |
| Exercise | Exercise | Green  |
| Quiz     | Quiz     | Orange |

### AC3 — Content rendering by type
- **Summary** — render sanitized rich text / HTML body in the centered content column (max-width 800px).
- **Video** — render a video player; auto-mark complete at ≥90% watched.
- **Exercise** — do **not** render inline. Redirect (`router.navigate`) to the exercise attempt route on lesson load.
- **Quiz** — render the inline quiz component; completion is driven by submission, not by this screen.

### AC4 — Optional content blocks
- **Resources.** If the lesson has a `resources[]` array, render a list with descriptive link text. Click triggers a download.
- **Related lessons.** If present, render a list of links to other lessons.

### AC5 — Sidebar
- Reuse the module accordion from the course dashboard. 280px wide on desktop.
- Active lesson is highlighted with the primary color.
- Completed lessons show a checkmark in the success color.
- Click a sidebar lesson → navigate to that lesson's route.
- **No background-color or side border** on the sidebar (project design rule — unified surface).

### AC6 — Previous / Next
- Footer shows two buttons. Each shows the truncated name of the target lesson.
- Previous is disabled on the first lesson of the course; Next is disabled on the last.
- Clicking either navigates to the corresponding lesson route within the same course.

### AC7 — Auto-completion
- **Video.** Mark complete on `timeupdate` once `currentTime / duration ≥ 0.9`.
- **Reading (Summary).** Mark complete when the content area scrolls to its bottom (≥95% of `scrollHeight - clientHeight`).
- **Exercise.** Marked complete by the exercise screen on submission, not here.
- **Quiz.** Marked complete by the quiz component on submission.

### AC8 — States
- **Loading.** Header skeleton, content placeholder, sidebar skeleton.
- **Loaded.** Full content; sidebar interactive; Prev/Next enabled per AC6.
- **Error.** Message + Retry button + "Back to course" link.
- **Not-found.** 404 message + "Back to course" link.

### AC9 — Responsive
- ≥769px: two-column, sidebar visible at 280px, content max-width 800px.
- ≤768px: single column, sidebar hidden (drawer pattern is **out of scope** this iteration; we just hide it). Content goes full-width with at least 16px gutter.

### AC10 — Accessibility
- Video has keyboard controls.
- All resource links have descriptive text (no "click here").
- Prev/Next buttons have aria-labels including the target lesson name.
- Headings follow a single h1 → h2 → h3 hierarchy.
- Skip link from the header bar to the content area.

## 3. Edge cases
- **Lesson without a body** — render the title and type badge with an empty-state hint ("This lesson has no content yet").
- **Single-lesson course** — both Prev and Next disabled.
- **Deep-link to a lesson in a course the user isn't enrolled in** — backend will 401/403; fall through to the global error interceptor.
- **Resources list with no items** — hide the entire Resources section, don't render an empty header.
- **Stale module list cached on the client** — if `lessonId` doesn't appear in the cached modules, refetch once before showing not-found.

## 4. Out of scope (explicit)
- Inline rendering of Exercise lessons.
- Sidebar drawer / hamburger on mobile.
- Bookmarks, notes, highlighting, comments, discussion.
- Offline content.
- Multi-language lesson bodies.

## 5. Analytics (initial cut)
- `lesson.view` on load, with `{ courseId, lessonId, type }`.
- `lesson.complete` on auto-completion, with `{ courseId, lessonId, type, trigger }`.
- `lesson.next_clicked` / `lesson.prev_clicked`.

## 6. Open questions
- Do Exercise lessons redirect, or do we eventually render them inline? (Current decision: redirect — see [design-full](./design-full.md) decision log.)
- Do we need a per-lesson share / deep-link UI? Probably yes, deferred.

## Links
[1-min](./prd-1min.md) · [5-min](./prd-5min.md) · [design](./design-1min.md) · [contract](./contract.yaml)
