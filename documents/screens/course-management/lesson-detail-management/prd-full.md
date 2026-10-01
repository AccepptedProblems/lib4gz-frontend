---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Lesson Detail Management — PRD (Full)

> Inherits problem, user, scope from [prd-5min.md](./prd-5min.md). Parent screen: [Course Management](../prd-full.md).

## Acceptance criteria

### Header

- Icon-only back button (`arrow_back`, `.icon-btn`) on the left. Click emits `back` output.
- Lesson title (`text-title-large`) displayed; adjacent edit icon button (`.icon-btn` with `edit` glyph) toggles inline edit mode.
- Module badge (`text-body-small`, neutral background pill) shows `moduleTitle` for context.
- Inline title edit: large text input + Save (`primary sm`) and Cancel (`secondary sm`). Enter saves, Escape cancels.
- Save calls `LessonService.update(lessonId, { title })`. On success, emits `lessonUpdated` with the updated `LessonResponse` and shows a success toast. On failure, shows an error toast and stays in edit mode.

### Summary section

- Section header row uses `.lesson-detail__section-header`: heading "Summary" (`text-title-small`) on the left, action button on the right.
- Header button label: **Edit** in view mode, **Save** in edit mode. Variant `primary`, size `sm`.
- View mode:
  - If `summaryLoading()`: show `lib-skeleton` (rect, 100% × 80px).
  - If `summary()?.content`: render the full content inside a `.summary-card`. URLs auto-linkify via `LinkifyPipe`. Links open in a new tab (`target="_blank"`, `rel="noopener noreferrer"`).
  - Else: "No summary yet." placeholder.
- Edit mode:
  - `lib-textarea` bound to `editSummaryValue` signal. `minRows=3`, no floating label, placeholder "Enter the lesson summary...", `ariaLabel` "Lesson summary".
  - Auto-resize is handled internally by `lib-textarea`; no manual resize handle.
- Save calls `SummaryService.createOrUpdate(lessonId, { content })`. Same call handles create and update. On success, updates the local `summary` signal and exits edit mode. Toast on success/failure.

### Exercises section

- Section header row: heading "Exercises" (`text-title-small`) on the left, "+ Add Exercise" button on the right (`primary sm`).
- "+ Add Exercise" navigates to `/course/:id/manage/exercise/new`, passing `lessonId` via router state.
- Loading state: 3 skeleton bars (`lib-skeleton` rect, 100% × 40px).
- Empty state: "No exercises yet for this lesson." (centered, secondary text).
- Loaded state: vertical `.exercise-list` (flexbox, not `<table>`).
  - Each `.exercise-item` row: title (`text-body-medium` weight 500), neutral type badge (`lib-badge variant="neutral"` with mapped label, see below), question count (`{{ count ?? '---' }} questions`, secondary text), then `.exercise-item__actions` group at the right.
  - Actions group: edit icon-btn (router nav to `/course/:id/manage/exercise/:exerciseId/edit`) and delete icon-btn (`.icon-btn--danger`, persistent red color).
- Exercise type label map: `TEXT_ANSWER → Text`, `CODE → Code`, `FILE_UPLOAD → File`, `MULTIPLE_CHOICE → MCQ`, `PROJECT_LINK → Project`.

### Delete exercise

- Delete icon opens `lib-dialog` with title "Delete Exercise", warning icon, and copy: "Are you sure you want to delete <strong>{{ name }}</strong>? This will also delete all student submissions for this exercise."
- Confirm calls `ExerciseService.delete(exerciseId)`. On success, removes the exercise from the local list, emits `exerciseDeleted` with the id, and toasts success.

## Edge cases

- **Same lesson re-emitted.** `effect()` reruns; UI shows skeletons briefly. Acceptable.
- **Summary is empty string vs null.** Empty string treated as "exists with empty content"; render a blank card. Null = "No summary yet." placeholder.
- **Long URL in summary.** Linkified anchor wraps; CSS uses `word-break: break-word` and pre-wrap to keep formatting.
- **Exercise list with duplicates by id.** Backend should not return duplicates; if it does, `track exercise.id` collapses them — fine for v1.
- **Delete during pending mutation.** Buttons disable while `deleting()` is true. Dialog cannot be re-confirmed.
- **Summary save mid-edit then user navigates back.** Back button does not block on unsaved changes in v1. Document as known limitation; consider a beforeunload-style guard later.
- **Exercise type returned outside the enum map.** Falls back to the raw type string in the badge.

## Error states

- **Summary fetch fails.** `catchError(() => of(null))` — treated as no summary; user can still create one.
- **Exercises fetch fails.** `catchError(() => of([]))` — treated as empty list; user can still add.
- **Title update fails.** Toast error; remain in edit mode.
- **Summary save fails.** Toast error; remain in edit mode with current text.
- **Exercise delete fails.** Toast error; row remains in list.

## Accessibility

- Wrapper has `role="region"` + `aria-label="Lesson detail"`.
- Back button: `aria-label="Back to modules"`.
- Edit title button: `aria-label="Edit lesson title"`.
- Inline edit input receives focus when activated.
- Each exercise row's edit/delete buttons have `aria-label` including the exercise title.
- Delete dialog uses `lib-dialog` modal semantics with focus trap.
- Textarea exposes `ariaLabel="Lesson summary"`.

[1-min](./prd-1min.md) · [5-min](./prd-5min.md) · [Tech design](./design-full.md) · [Parent screen](../prd-full.md)
