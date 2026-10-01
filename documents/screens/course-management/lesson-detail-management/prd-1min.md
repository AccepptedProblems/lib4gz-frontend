---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Lesson Detail Management — PRD (1-min)

> Child component of [Course Management](../prd-1min.md). Inherits user, role gating, and overall screen context from the parent.

- **Problem.** Inside a course, a teacher needs to edit a single lesson's title, write/update its summary, and manage its exercises in one place — without leaving the course management hub.
- **Primary user.** Course teacher inside `app-course-management`, after clicking a lesson in the module list.
- **Outcome.** A focused sub-view rendered by `app-lesson-detail-management` that loads the lesson's summary and exercises, allows inline title and summary edits, and links out to the exercise editor.
- **Why a child component.** Encapsulates self-contained data (summary + exercises) and dialogs (delete-exercise) so the parent stays focused on course/module/lesson list state.
- **Success metric.** Teachers can move from "click lesson" to "summary saved" without leaving the screen and without a full page reload.
- **Scope (in).** Title inline edit, inline summary editing via textarea (auto-resize), exercises list (vertical, not table), edit/delete exercise navigation/dialog, back to module list.
- **Scope (out).** Rich-text summary editor, exercise creation form (`app-exercise-editor` is a separate screen), reordering exercises.
- **Lives at.** `src/app/components/course-teacher/course-management/lesson-detail-management/`.

[5-min](./prd-5min.md) · [Full](./prd-full.md) · [Tech design](./design-1min.md) · [Parent screen](../prd-1min.md)
