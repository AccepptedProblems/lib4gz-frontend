---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Exercise Editor — PRD (full)

> Full version of the PRD. Audience: implementer, QA, future maintainer. The 1-min and 5-min versions cover problem, scope, and success metric; this doc adds detailed acceptance criteria, edge cases, error states, and analytics requirements.

## 1. Acceptance criteria per user story

### US-1 — Create an exercise with questions

- AC-1.1 Route `/course/:id/manage/exercise/new` renders the editor in create mode (page title "Create Exercise").
- AC-1.2 The form starts empty: title blank, exercise type defaulted to `TEXT_ANSWER`, no questions.
- AC-1.3 The teacher can add questions via "+ Add Question". A new card opens directly in edit mode.
- AC-1.4 Only one question card is in edit mode at a time. Editing or adding another question first auto-saves (if it has content) or discards (if newly added and empty) the current edit.
- AC-1.5 Clicking "Save Exercise" with valid input creates the exercise *and* its questions in a single API call (`exercises.create` with inline `questions[]`) and navigates back to `/course/:id/manage` with `lessonId` in router state.
- AC-1.6 If `lessonId` is missing from router state, save fails with the toast "Lesson context is missing. Please go back and try again." and no API call is made.

### US-2 — Fast Create from numbered text

- AC-2.1 The "Fast Create" button opens a modal (max-width 600px) containing a `lib-textarea` (minRows 8) and Cancel / Confirm buttons.
- AC-2.2 The teacher pastes raw text. After a 200ms debounce the editor parses it and updates the confirm button label to "Add N Questions".
- AC-2.3 The **only** split delimiter is a numbered index at line start, matched by `^\s*(\d+)\s*[.)]\s*`. Examples: `1.`, `2)`, `  3.` (leading whitespace is allowed). The number prefix is stripped from the question content.
- AC-2.4 Everything between one numbered index and the next is preserved verbatim inside the question's content, including:
  - Internal newlines (joined with `\n`).
  - Dashes (`-`), bullets (`*`), or numeric digits *not* at the start of a line.
  - Conversation-style lines such as `- Alice: hello`.
  - Indented or blank lines.
- AC-2.5 Lines before the first numbered index are dropped.
- AC-2.6 Confirm appends the parsed questions in order to the existing list. Each new question inherits the current default answer options (MC only).
- AC-2.7 Cancel closes the dialog with no side effect on the question list.
- AC-2.8 If the parser detects 0 questions, the confirm button is disabled.

### US-3 — Edit an existing exercise

- AC-3.1 Route `/course/:id/manage/exercise/:exerciseId/edit` renders the editor in edit mode (page title "Edit Exercise").
- AC-3.2 On init, the editor calls `ExerciseService.get(exerciseId)` and `QuestionService.listByExercise(exerciseId)` in parallel and shows a skeleton until both resolve.
- AC-3.3 On load, `originalQuestions` is set to a snapshot of the loaded list. This snapshot drives the diff at save time.
- AC-3.4 On save, the editor calls `ExerciseService.update(exerciseId, { title, type })` then `QuestionService.batchUpdate(exerciseId, { questions })` with only the diff items (CREATE / UPDATE / DELETE). If the diff is empty, `batchUpdate` is **not** called.
- AC-3.5 An "unchanged" question is one whose `content`, `orderIndex`, and `JSON.stringify(meta)` all match the original. Unchanged items are not sent to the API.

### US-4 — Switch exercise type

- AC-4.1 The type selector is a compact (`small-input`, `max-width: 280px`) `<select>` with two options: Multiple Choice, Text Answer.
- AC-4.2 If the teacher switches *from* `MULTIPLE_CHOICE` to `TEXT_ANSWER` while at least one question carries `meta.options`, a confirmation dialog appears: "Changing the type will reset answer options for all existing questions. Continue?"
- AC-4.3 On confirm, every existing question's `meta` is reset (`{}` for `TEXT_ANSWER`, `{ options: DEFAULT_MC_OPTIONS }` for `MULTIPLE_CHOICE`).
- AC-4.4 On cancel, the selector reverts.
- AC-4.5 When type is `MULTIPLE_CHOICE`, the Default Answers section is visible; when type is `TEXT_ANSWER`, it is hidden.

### US-5 — Unsaved-changes protection

- AC-5.1 The `isDirty` signal is true whenever the current snapshot of `{ title, type, questions[].{id, content, meta} }` differs from the snapshot taken at last save (or at load in edit mode, or empty in create mode).
- AC-5.2 Clicking "Cancel" with `isDirty === true` opens the Unsaved Changes dialog. "Stay" closes it; "Leave" navigates back to `/course/:id/manage` with `lessonId` in router state.
- AC-5.3 Browser close / refresh with `isDirty === true` triggers the native `beforeunload` prompt.
- AC-5.4 A successful save calls `takeSnapshot()` so navigation immediately afterward is treated as clean.
- AC-5.5 Cancel with `isDirty === false` navigates immediately, no dialog.

### US-6 — Default answer options

- AC-6.1 The Default Answers section appears only when type is `MULTIPLE_CHOICE`.
- AC-6.2 Default options support 2–6 entries with exactly one marked correct (radio).
- AC-6.3 New questions added after the defaults are edited inherit a **clone** of the current defaults; previously created questions are *not* updated retroactively.
- AC-6.4 If the teacher deletes the option currently marked correct, the first remaining option becomes correct.

## 2. Edge cases

| # | Case | Behaviour |
|---|---|---|
| EC-1 | Teacher pastes text into Fast Create with no numbered lines | 0 questions detected, confirm button disabled. |
| EC-2 | Numbered line appears mid-question (e.g. "Section 1. Intro" written by the teacher inside a question) | Treated as a split because the regex is anchored to line start. **Known limitation** — documented in placeholder text. |
| EC-3 | Fast Create text starts with prose before the first `1.` | Prose is dropped silently. |
| EC-4 | Teacher hits "Add Question" while another card is in edit mode with empty content and `isNew = true` | The empty new card is removed; the new add proceeds. |
| EC-5 | Teacher hits "Add Question" while another card is in edit mode with non-empty content | The current card auto-saves (without re-validating MC option counts) before the new card opens. |
| EC-6 | Teacher deletes the question currently being edited | `editingIndex` resets to `null`; the card disappears. |
| EC-7 | Teacher reorders by deletion (delete + re-add) | Remaining questions re-number contiguously; `orderIndex` is recomputed on save. |
| EC-8 | Edit mode load fails (network / 401 / 404) | Screen state becomes `error`, shows error icon + "Failed to load exercise. Please try again." + Go Back button. |
| EC-9 | Save fails | Toast "Failed to save exercise. Please try again." Stays on page. `isSaving` resets. `isDirty` remains true. |
| EC-10 | Type switch from `TEXT_ANSWER` to `MULTIPLE_CHOICE` | No confirmation needed (no options to wipe). All existing questions get `DEFAULT_MC_OPTIONS` cloned into `meta.options`. |

## 3. Error states (UI)

- **Title required.** Inline error under the title field: "Title is required". Cleared on first non-empty input.
- **At least one question required.** Inline error above the question list: "At least one question is required".
- **Question content required.** Inline error inside the question card: "Question N: text is required" / "Question text is required" (inline-edit variant).
- **MC: < 2 options.** "Question N: at least 2 answer options required".
- **MC: empty option text.** "Question N: all answer options must have text".
- **MC: no correct answer.** "Question N: select a correct answer".
- **Save failure.** Toast (`ToastService.error`) — no inline error, the user can retry.
- **Load failure.** Full-screen error state with "Go Back" button (returns to lesson management).

## 4. Analytics requirements

The original spec did not define analytics events. The following are proposed (mark **TBD** until product confirms):

| Event | Properties | Trigger |
|---|---|---|
| `exercise_editor_opened` | `mode` (create / edit), `exerciseId?`, `courseId` | On component init. |
| `exercise_saved` | `mode`, `exerciseId`, `type`, `questionCount`, `durationMs` (open → save) | Save success. |
| `exercise_save_failed` | `mode`, `errorCode` | Save failure. |
| `fast_create_used` | `parsedCount` | Confirm Fast Create. |
| `unsaved_changes_dialog_shown` | `outcome` (stay / leave) | When dialog closes. |
| `exercise_type_changed` | `from`, `to`, `confirmed` | After confirm/cancel of type-switch dialog. |

## 5. Accessibility

- Every form field is labelled (via `lib-textarea` / `lib-input` floating labels).
- Question card icon buttons have `aria-label` ("Edit question N", "Delete question N").
- Both dialogs (Fast Create, Unsaved Changes, Type Change) trap focus — provided by `lib-dialog`.
- Radio groups in answer options use a per-question `name` attribute so screen readers announce the right group.
- Keyboard: tab order follows visual order; Enter / Space activates buttons; Esc closes dialogs (provided by `lib-dialog`).

## 6. Out of scope (restated)

See [`prd-5min.md`](./prd-5min.md) § Scope (out). Reordering, attachments, multi-correct MC, weighted scoring, AI generation, MC-options bulk import, and auto-save are **not** in this iteration.
