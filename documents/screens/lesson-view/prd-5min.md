---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Lesson View — PRD (5 min)

## Problem
The lesson route is a stub. A student who clicks a lesson in the course dashboard cannot actually read the lesson, see their position in the course, or move on. Today they bounce back to the dashboard and lose context.

## Primary user
**Students** enrolled in the course. Teachers preview through the same screen but author elsewhere — they're a secondary audience and we will not gate the route on role beyond `authGuard`.

## Outcome
At `/course/:courseId/lesson/:lessonId` the student gets:

- **Title + type badge** so they immediately know what kind of lesson this is.
- **Position indicator** ("Lesson 3 of 12") so they know how far they are.
- **Content body** rendered for the lesson type (rich text, video embed, quiz, or redirect to exercise).
- **Sidebar** with the same module accordion the dashboard uses, so they can jump anywhere in the course.
- **Previous / Next** at the foot, disabled at course endpoints.

## User stories
- As a student I open a lesson from the dashboard and see its title and content immediately.
- As a student I know which lesson number I'm on out of how many.
- As a student I can jump to any other lesson via the sidebar without going back to the dashboard.
- As a student I can move Previous/Next with one click.
- As a student on a video lesson, the lesson auto-completes when I've watched ~90%.
- As a student on mobile, the sidebar gets out of my way.

## Scope
**In:** route wiring, header bar, type badge, content rendering for Summary / Video / Quiz, sidebar reuse, Prev/Next, loading + error + 404 states, auto-complete for video and reading, mobile layout (no sidebar).

**Out (this iteration):**
- Authoring / editing lessons — covered by the teacher screens.
- Inline Exercise rendering — Exercise lessons redirect to the exercise attempt screen instead of rendering inline.
- Discussion / comments under a lesson.
- Bookmarks, notes, highlighting.
- Offline / download-for-later.

## Key assumptions
- `LessonService.get(lessonId)` returns the full lesson payload (type + body + resources).
- `ModuleService.listByCourse(courseId)` returns the same module/lesson tree the dashboard uses, so we can reuse the sidebar.
- Position is computable client-side from the module list — no dedicated endpoint.

## Risks
- **Content variety.** Rich-text bodies may include arbitrary HTML; we need a sanitization story before shipping author tools.
- **Video provider.** The embed strategy (HTML5 vs. third-party iframe) is not yet decided — see [design-full](./design-full.md) open questions.
- **Auto-completion accuracy.** "Mark complete at 90%" assumes we can hook the player; if we ship with a third-party iframe we may have to drop to manual.

## Dependencies
- Course dashboard module list shape (already implemented).
- `LessonService` and `ModuleService` already exist in `src/app/services/`.
- `lib-button`, `lib-spinner` shared components.

## Links
[1-min PRD](./prd-1min.md) · [full PRD](./prd-full.md) · [design](./design-1min.md) · [contract](./contract.yaml)
