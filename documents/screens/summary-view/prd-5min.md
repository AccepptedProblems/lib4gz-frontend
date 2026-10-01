---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Summary View — PRD (5 min)

## Problem

Students inside a course need to actually read the lesson's main content. Today the `summary-view` component is a scaffold (`<p>summary-view works!</p>`) and the route isn't registered, so picking a lesson can't show its written material.

## Primary user

Enrolled student (LEARNER) reading lesson summaries while progressing through a course. Teachers may also land here when previewing content, but that's not the design driver.

## Outcome

A lesson, opened from the course sidebar, shows:

- A breadcrumb (Course > Module > Lesson).
- The lesson title + summary content (text, headings, lists, images, video embeds, code, links).
- A footer with **Previous lesson**, **Mark Complete** (toggle), **Next lesson**.
- The course sidebar (rendered by the parent course layout) stays visible and reflects current/completed lessons.

## User stories

- *As a student*, I open a lesson from the sidebar and see its summary rendered as a readable column so I can study it.
- *As a student*, I click **Next** at the end of a summary and land on the next lesson without losing my place in the course.
- *As a student*, I click **Mark Complete** to record that I've finished a lesson; the sidebar reflects the change immediately.
- *As a student on mobile*, the content fills the screen and the navigation footer stays usable (sidebar is the parent layout's drawer).

## Scope

**In scope**

- Render summary content (HTML/Markdown) for a given `lessonId`.
- Sanitize HTML; auto-linkify plain URLs (existing `LinkifyPipe`); external links open in a new tab.
- Prev / Next navigation that crosses module boundaries (last lesson of prev module, first of next).
- Manual Mark Complete toggle with optimistic UI + rollback on error.
- Loading skeleton, loaded state, error state.

**Out of scope (this iteration)**

- Authoring/editing the summary (lives in teacher-side `lesson-detail-management`).
- Auto-completion based on scroll/time-on-page.
- Comments, annotations, highlights, bookmarks.
- Per-lesson analytics dashboards.
- Server-driven progress percentages.

## Key assumptions

- Summary content is fetched via `summaries.get` (`GET /v1/lessons/{lessonId}/summary`) and returns sanitized-on-server HTML/Markdown — the frontend still re-sanitizes defensively.
- The course sidebar (with module/lesson tree + completion status) is owned by the parent course layout, not by this screen.
- Lesson order within a module and module order within a course are deterministic and available client-side after a single `modules.list-by-course` call.

## Risks / open questions

- **Mark-complete endpoint is not defined** in `network/api-endpoints.yaml` (no `lessons.complete` or equivalent). Either the endpoint must be added or the toggle must be deferred. Decision needed before implementation.
- **Route shape mismatch.** Source spec defines `/course/:courseId/lesson/:lessonId/summary`, but the live router uses `/course/:id/lesson/:lessonId` rendered by `course-lesson.component.ts`. We need to decide whether `summary-view` becomes the lesson page itself, a tab inside it, or a sub-route. See `design-5min.md`.
- **Content schema.** Whether summaries are stored as HTML or Markdown is a backend decision; the frontend needs to handle whichever ships.

## Dependencies

- Parent **course layout** (sidebar + breadcrumb host).
- Services: `SummaryService`, `LessonService`, `ModuleService`.
- Shared `lib-button`, `lib-spinner`, design tokens.

## Success metrics

- Time-to-first-content ≤ 1s on warm cache.
- ≥ 95% of summary fetches succeed without a visible error state.
- ≥ 80% of lesson-to-lesson moves use Prev/Next (vs. clicking the sidebar).
