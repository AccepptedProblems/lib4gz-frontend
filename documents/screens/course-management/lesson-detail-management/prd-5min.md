---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Lesson Detail Management — PRD (5-min)

> Sub-view of [Course Management](../prd-5min.md). Read the parent first for layout and screen-level context.

## Problem

When a teacher clicks a lesson in the module accordion, they need to do three things quickly: confirm the lesson title is right, write or revise the summary, and manage exercises (review, edit, delete). Splitting these into separate screens or modals breaks the flow of editing a course.

## Primary user

Course teacher, already inside `app-course-management`, who has selected a lesson by clicking its row in the module list.

## Outcome

A focused sub-view rendered when `materialSubView === 'lesson-detail'`. Header shows lesson title (editable inline) plus the parent module name as context. Summary section shows the full summary (or "No summary yet.") with an Edit button that swaps the preview for a `lib-textarea`. Exercises render as a vertical list with type badge, question count, and edit/delete actions. A back button returns to the module list.

## User stories

- *As a teacher,* I see the full summary text (no truncation) and can edit it inline without opening a separate editor.
- *As a teacher,* I can fix a typo in the lesson title without leaving this view.
- *As a teacher,* I see all exercises for this lesson at a glance with their type and question count.
- *As a teacher,* I can delete an exercise after confirming a warning about cascading student submissions.
- *As a teacher,* I can jump to the exercise editor to modify or create an exercise.
- *As a teacher,* I always see which module this lesson belongs to.

## Scope

**In**
- Inputs: `courseId`, `lesson`, `moduleTitle`. Outputs: `back`, `lessonUpdated`, `exerciseDeleted`.
- Self-contained data loading via `effect()` on `lesson` input change: `SummaryService.get` + `ExerciseService.listByLesson`.
- Inline title editing (`LessonService.update`).
- Inline summary editing via `lib-textarea` (auto-resize, no manual handle); save calls `SummaryService.createOrUpdate`.
- Exercises list (flexbox, not `<table>`) with edit (router nav) and delete (confirmation dialog) actions.
- Loading skeletons for summary and exercises.
- URL auto-linkification in summary preview via `LinkifyPipe`.

**Out**
- Rich-text editor for the summary (plain text + line breaks only in v1).
- Exercise creation/editing inline (delegated to `/course/:id/manage/exercise/:id|new`).
- Reordering exercises.
- Versioning UI for the summary (backend has `version` field; not surfaced).

## Key assumptions

- A lesson has at most one summary. `createOrUpdate` semantics means the same call covers both create and update.
- Summary content fits in a textarea — no images or formatting.
- Auto-linkification is "good enough" for sharing links to materials.

## Risks & dependencies

- **Linkify XSS surface.** Summary is rendered with `[innerHTML]` after running through `LinkifyPipe`. The pipe must escape any non-link content; otherwise stored XSS becomes possible.
- **Lesson input churn.** The `effect()` on `lesson` reloads summary + exercises. If the parent re-emits the same lesson by reference change, we waste calls. Identity stability matters.
- **Delete cascade.** Deleting an exercise also discards student submissions on the backend; the dialog must say so explicitly.
- **Depends on:** `LessonService`, `SummaryService`, `ExerciseService`, `Router`, `ToastService`; shared `lib-button`, `lib-badge`, `lib-skeleton`, `lib-dialog`, `lib-textarea`, `LinkifyPipe`.

[1-min](./prd-1min.md) · [Full](./prd-full.md) · [Tech design](./design-5min.md) · [Parent screen](../prd-5min.md)
