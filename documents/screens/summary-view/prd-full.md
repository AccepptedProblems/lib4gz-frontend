---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Summary View — PRD (full)

## 1. Problem & user

A student inside a course picks a lesson from the sidebar; we owe them the lesson's written material — paragraphs, headings, images, embedded video, code blocks, links — in a readable layout, with one click to move to the adjacent lesson and one click to mark it done.

The component (`SummaryViewComponent`) exists but is a placeholder. There is no live route, no data fetch, no navigation footer, no styling. Until this ships, lessons cannot be consumed.

**Primary user.** Enrolled student (LEARNER).
**Secondary.** Teacher previewing their own course (read-only — editing happens elsewhere).

## 2. Outcome (what changes for the user)

| Before | After |
|---|---|
| Lesson page renders a placeholder. | Lesson page renders sanitized HTML/Markdown summary in a centered, ~70-char readable column. |
| No way to advance lessons in-page. | Footer offers **Previous**, **Mark Complete**, **Next**; first/last lessons disable Prev/Next. |
| No completion signal. | Mark Complete toggles the sidebar checkmark optimistically. |

## 3. Success metrics

- **Time-to-first-content** ≤ 1s on warm cache, ≤ 2.5s cold.
- **Render success rate** ≥ 95% (no visible error state).
- **In-page navigation rate** ≥ 80% — students click Prev/Next/sidebar instead of leaving the course.

## 4. Scope

**In scope**

- Read-only render of lesson summary content for `:lessonId`.
- Loading skeleton, content state, error state.
- Prev/Next navigation that crosses module boundaries.
- Manual Mark Complete with optimistic UI + rollback.
- HTML sanitization, plain-URL auto-linkification, external `target="_blank" rel="noopener noreferrer"`.
- Responsive layout: ≥ 768px column inside parent layout; < 768px full-width with sidebar collapsed by parent.

**Out of scope (this iteration)**

- Editing summaries (teacher-side `lesson-detail-management`).
- Auto-mark-complete based on scroll position / dwell time.
- Comments, highlights, bookmarks, notes.
- Analytics ("X% of class read this lesson").
- Server-side progress percentages or streaks.

## 5. User stories & acceptance criteria

### US-1 — Read a lesson summary
*As a student*, I open a lesson and see its content rendered.

- AC1: Breadcrumb shows `Course > Module > Lesson`, with course/module clickable, lesson static.
- AC2: Lesson title renders as `text-headline-medium`.
- AC3: Body content renders with the typography scale (h1–h6, p, lists, code).
- AC4: Images render responsive and centered; videos render as embedded players.
- AC5: Plain-text URLs become external links via `LinkifyPipe`; external links carry `target="_blank" rel="noopener noreferrer"`.
- AC6: Content column is max 800px wide, centered, ~70 chars per line.
- AC7: Loading state shows a content skeleton; error state shows a message + "Back to course" action.

### US-2 — Move to adjacent lesson
*As a student*, I click Next/Previous and the next/previous lesson loads.

- AC1: **Previous** is disabled when on the first lesson of the first module.
- AC2: **Next** is disabled when on the last lesson of the last module.
- AC3: At a module boundary, Prev jumps to the previous module's last lesson; Next to the next module's first lesson.
- AC4: Navigating updates the URL `:lessonId` and the sidebar's "current lesson" highlight without a full reload.

### US-3 — Mark complete (manual)
*As a student*, I toggle Mark Complete to record progress.

- AC1: Click toggles the button label/state immediately (optimistic).
- AC2: API call persists the change; on error, the toggle rolls back and a toast/inline error appears.
- AC3: Sidebar reflects the new completion state for this lesson.
- *Blocker:* the persistence endpoint is not yet defined — see §7.

### US-4 — Keyboard & a11y
- AC1: All footer buttons are keyboard-reachable in source order.
- AC2: Focus moves to the lesson title (or skip-to-content target) on lesson change.
- AC3: Images carry `alt` text; videos with captions retain them.
- AC4: Heading hierarchy in content is correct (no h1 inside body if title is h1).

## 6. States

| State | What the user sees |
|---|---|
| `loading` | Breadcrumb placeholder, content skeleton, footer disabled. |
| `loaded` | Content rendered, sidebar shows current lesson, footer enabled per first/last rules. |
| `completed` | Mark Complete shows the "checked" variant; sidebar shows checkmark. |
| `error` | Error message + "Back to course" button; sidebar still functional. |

## 7. Risks & open questions

| # | Item | Owner | Notes |
|---|---|---|---|
| R1 | No `lessons.complete` API endpoint exists. | Backend | Either add `POST /v1/lessons/{lessonId}/completion` or defer Mark Complete. |
| R2 | Route shape disagreement: spec said `/course/:courseId/lesson/:lessonId/summary`, live router uses `/course/:id/lesson/:lessonId` via `course-lesson.component.ts`. | FE lead | Pick a model — see `design-5min.md` §"Route shape". |
| R3 | Summary stored as HTML or Markdown? | Backend | Frontend will sanitize either, but render path differs. |
| R4 | Sidebar ownership — parent layout vs. this component? | FE lead | Parent layout already renders the sidebar; this component should NOT re-render it. |

## 8. Dependencies

- **Components:** parent course layout (sidebar host), `lib-button`, `lib-spinner`.
- **Services:** `SummaryService.get(lessonId)`, `LessonService.get(lessonId)`, `ModuleService.listByCourse(courseId)`.
- **Pipes:** `LinkifyPipe` for plain-URL auto-linkification.
- **API:** `summaries.get`, `lessons.get`, `modules.list-by-course` (see `network/api-endpoints.yaml`).
- **Design tokens:** typography scale, spacing, primary + semantic colors, breakpoint `768px`.

## 9. Edge cases

- Empty summary (lesson exists but `summaries.get` returns 404) → render "No content yet" state, footer still works.
- Single-lesson course → both Prev and Next disabled.
- User loses connection mid-Mark-Complete → rollback + retry option.
- Deep-linking to an invalid `lessonId` → error state, not a blank page.
- Very long summary → respect content width; rely on browser scrolling.
