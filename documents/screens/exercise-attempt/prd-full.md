---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Exercise Attempt — PRD (full)

This document is the deep version. Read [prd-1min](./prd-1min.md) for context and [prd-5min](./prd-5min.md) for the structured summary; this file expands on acceptance criteria, edge cases, and analytics.

## Acceptance criteria

Grouped by user story.

### S1 — Single screen lists every exercise as tabs

- Route is exactly `/course/:id/lesson/:lessonId/attempt`. The previous `/course/:id/exercise/:exerciseId/attempt` is gone.
- On load, the screen calls `ExerciseService.listByLesson(lessonId)` and renders one tab per exercise, sorted by `orderIndex` ascending.
- Tab label format: `Exercise {1-based index}`. Tabs do **not** include the exercise title (the title is shown inside the tab content area).
- The first tab is selected by default after load.
- Switching tabs is instant: questions and existing answers are already in memory.

### S2 — Switching tabs does not lose answers

- Answers are stored client-side in a per-exercise map until saved.
- Switching to another tab triggers an immediate save of the previous tab's draft if `isDirty`.
- On reload, drafts are restored from the server-side submission (any status — `DRAFT`, `SUBMITTED`, `NEEDS_REVISION`, `APPROVED`).

### S3 — Header shows lesson context

- Header reads `Exercise {prefix}` when `?prefix=` is present (e.g. `Exercise 1.2`).
- Header reads `Exercise` when the query param is missing (defensive fallback; never expected from the dashboard).
- Header is sticky at top with `z-index 10`. Tab bar is sticky directly below at `z-index 9`. The tab bar's `top` equals `--header-bar-height` (default 57px).

### S4 — Drafts pre-fill on return

- For every exercise, the screen calls `SubmissionService.getMySubmission(exerciseId)`. A 404 means no prior attempt and is **not** an error.
- If a submission exists, its `answers` are merged into `answersMap` regardless of status. This includes already-submitted attempts so the learner sees their previous work.

### S5 — Fast Fill Answer

- The Fast Fill button sits on the right of the tab bar and applies only to the **currently active** exercise.
- Dialog contains a `lib-textarea` (`minRows=6`) and a live counter `{N} answers detected ({M} questions total)` updated with a 200ms debounce.
- Parsing regex: `^\s*(\d+)\s*[.)]\s*` (same as `exercise-editor` Fast Create). Multi-line content between numbered indices belongs to the previous answer.
- Distribution is positional: `parsedAnswers[i] → activeQuestions()[i]`. Excess parsed answers are dropped; missing ones leave existing answers untouched.
- For `MULTIPLE_CHOICE`, parsed text is matched case-insensitively against `question.meta.options`. On match, the canonical option text is stored. On miss, the raw text is stored (student can fix manually).
- Confirm label dynamically reads `Fill {N} Answers`.
- Confirming triggers auto-save and closes the dialog. Cancel closes with no changes.

### S6 — Submit confirmation

- Submit button in the header opens `lib-dialog` titled `Submit Exercises`.
- If `unansweredCount > 0`, the body shows:
  - `You have answered {answered} out of {total} questions.`
  - A list (no bullets) of exercises with unanswered questions, each row: warning icon + `Exercise {1-based index} — {n} question(s) not answered`.
- If everything is answered: `You have answered all {total} questions. Ready to submit!` (no breakdown).
- Always shown: `Are you sure you want to submit your answers?`
- Confirm → `SubmissionService.submit(submissionId)` for each exercise that has a submission, in parallel. On all-success, navigate to `/course/:id`. On any error, close dialog, toast, stay on page.

### S7 — Cancel with unsaved work

- If `isDirty`, save all drafts first, then open `lib-dialog` titled `Leave Exercise?` with destructive confirm `Leave` and cancel `Stay`.
- If clean, navigate directly to `/course/:id`.

## Edge cases

| Case | Expected behavior |
|---|---|
| Lesson has zero exercises | Render `no-exercises` state with placeholder message and `Go Back` button. |
| `listByLesson` fails | Render `error` state with `error_outline` icon, message, and `Go Back`. |
| `listByExercise` fails for one exercise | Treat the screen as `error` (we cannot show partial tabs without misleading the student). |
| `getMySubmission` returns 404 | Treat as "no prior attempt"; the answers map for that exercise stays empty. |
| `getMySubmission` returns non-404 error | Treat the whole screen as `error`. |
| `createOrUpdate` (auto-save) fails | Brief inline error indicator; keep `isDirty=true` so next change retries. Do not block typing. |
| `submit` fails for one exercise (others succeed) | Close dialog, show error toast, stay on page. The successful submissions are already finalized server-side. |
| Network drops mid-save | Same as above — error indicator, retry on next change. |
| `prefix` query param missing | Header falls back to `Exercise` (no prefix). No error. |
| Student pastes Fast Fill into MC where no option matches | Raw text is stored; the radio group renders as if nothing is selected (because the value matches no option). Counter still increments. |
| Student pastes more answers than questions | Excess answers silently ignored. |
| Student tabs away mid-edit and comes back | `isDirty` may already have been auto-saved (tab switch flushes immediately); on return, the answer is intact. |

## Responsive behavior

| Breakpoint | Behavior |
|---|---|
| `>= 768px` | Centered content, max-width 800px. Header title and buttons share a row. Tabs `padding 10px 20px`. |
| `< 768px` | Full-width with 16px padding. Header title and buttons stack (title row, then buttons row). Tab bar overflow-x scroll. Radio options have `min-height 44px` for touch. |

## Accessibility

- Tab bar uses `role="tablist"`; each tab is `role="tab"` with `aria-selected` reflecting active state.
- Tab content panel has `role="tabpanel"` and `aria-labelledby` referencing the active tab.
- Radio groups have a shared `name` and `aria-label` pulled from question content/index.
- Textarea has `aria-label` referencing the question number.
- Confirmation dialogs use `role="dialog"` with `aria-modal="true"`.
- Keyboard: Tab cycles focus across interactive elements; arrow keys navigate within a radio group and within the tablist.

## Analytics (TBD)

The original spec did not enumerate analytics events. To be defined with PM — minimum candidates:

- `exercise_attempt.opened` (lessonId, exerciseCount, hasExistingDraft).
- `exercise_attempt.tab_switched` (fromIndex, toIndex).
- `exercise_attempt.fast_fill_used` (exerciseIndex, parsedCount, questionCount).
- `exercise_attempt.submitted` (lessonId, answered, total, unansweredExercises).
- `exercise_attempt.cancel_with_changes`.

Track once instrumentation is added in a follow-up.

## Wireframes

Inline ASCII layouts referenced in [design-full.md](./design-full.md). No external Figma link captured in the original spec.

Links: [1-min](./prd-1min.md) · [5-min](./prd-5min.md) · [tech design full](./design-full.md) · [contract](./contract.yaml)
