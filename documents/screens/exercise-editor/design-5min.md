---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Exercise Editor — Tech Design (5-min)

## What we're building

One standalone Angular component, `ExerciseEditorComponent` (file paths in [`contract.yaml`](./contract.yaml)), that serves both **create** (`/course/:id/manage/exercise/new`) and **edit** (`/course/:id/manage/exercise/:exerciseId/edit`) routes. It owns an exercise's title, type, and questions; calls `ExerciseService` and `QuestionService`; and manages Fast Create + unsaved-changes dialogs locally.

## System context

```
Lesson Management (course-management)
   │  (router state: { lessonId })
   ▼
Exercise Editor (this screen)        ◄── navbar hidden via AppComponent.hiddenRoutes
   │
   ├── ExerciseService.{get,create,update}     ──► /v1/{lessons,exercises}/...
   ├── QuestionService.{listByExercise,batchUpdate} ──► /v1/exercises/{id}/questions
   └── ToastService                  (success / error feedback)
   │
   ▼ (on save)
Lesson Management (router state: { lessonId })
```

- **Entry.** Always from the lesson management screen. The lesson management screen places `lessonId` in router state; this screen reads it from `Router.getCurrentNavigation()` / `history.state` on init.
- **Exit.** Always back to `/course/:id/manage` with `lessonId` re-passed in router state, so the lesson management screen can scroll/expand to the right lesson.
- **Layout.** The route is added to `AppComponent`'s `hiddenRoutes` list so the navbar is suppressed for a distraction-free editor.
- **Auth.** `authGuard` + `roleGuard` (`roles: ['teacher']`) — see `app.routes.ts`.

## Data flow

### Signals owned by the component

| Signal | Purpose |
|---|---|
| `courseId`, `exerciseId`, `lessonId` | Route / state context. |
| `isEditMode` (computed) | `!!exerciseId()`. |
| `screenState` | `'loading' \| 'loaded' \| 'error'`. |
| `exerciseTitle`, `exerciseType` | Bound to title textarea and type select. |
| `questions` | `EditorQuestion[]` — the live list. |
| `originalQuestions` | Snapshot at load (edit mode); drives the diff. |
| `editingIndex` | Index of the card currently in edit mode (`null` if none). |
| `tempContent`, `tempOptions` | Working state for the in-edit card. |
| `defaultOptions` | Exercise-level placeholders for new MC questions. |
| `savedSnapshot` (private) | JSON snapshot at last save / load; drives `isDirty`. |
| `isDirty` (computed) | Current snapshot ≠ saved snapshot. |
| `showFastCreate`, `showUnsavedDialog`, `showTypeChangeDialog` | Dialog visibility. |
| `fastCreateText`, `parsedQuestions` | Fast Create input / output. |
| `isSaving` | Disables the form and shows the Save spinner. |
| `titleError`, `questionsError`, `questionErrors`, `questionOptionErrors` | Inline validation. |

The exact code is in `src/app/components/course-teacher/exercise-editor/exercise-editor.component.ts`.

### Service calls

| Trigger | Calls |
|---|---|
| Init (edit mode) | `forkJoin({ exercise: ExerciseService.get(id), questions: QuestionService.listByExercise(id) })` |
| Save (create) | `ExerciseService.create(lessonId, { title, type, questions })` (single call, inline questions) |
| Save (edit) | `ExerciseService.update(exerciseId, { title, type })` then, if diff non-empty, `QuestionService.batchUpdate(exerciseId, { questions })` |

References: [`network/api-endpoints.yaml#/resources/exercises`](../../network/api-endpoints.yaml), [`network/api-endpoints.yaml#/resources/questions`](../../network/api-endpoints.yaml).

### Fast Create parser

- Splits input on `^\s*(\d+)\s*[.)]\s*` (line-anchored). The matched prefix is stripped from the first line of each question; remaining lines are appended verbatim with their original `\n` between them. Lines before the first match are dropped. Trailing/leading whitespace per question is trimmed.
- Parsing runs on a 200ms-debounced subject (`fastCreateInput$`) so the count in the confirm button updates as the teacher types/pastes.

## Key tradeoffs

| Choice | Bought | Gave up |
|---|---|---|
| One component for both routes (mode = `!!exerciseId`). | Single source of truth for editor state and validation. | Slightly larger component file. |
| Diff-on-save (`buildUpdateItems()`) using `JSON.stringify(meta)` equality. | Preserves question IDs across edits; minimal payload; submission references stay intact. | Diff is sensitive to `meta` key-order drift. Mitigated by always constructing `meta` from a fixed local shape. |
| Single-regex Fast Create delimiter. | Predictable; teachers can paste chat logs, lists, multi-line questions without surprise splits. | "Section 1." inside content **is** a split point — known limitation, documented to teachers. |
| Inline edit (one card expanded) vs. edit-in-modal. | Question stays in context with siblings; quick scan + edit. | Only one question editable at a time; switching cards triggers an auto-save/discard. |
| Default Answers as a placeholder section (not retroactive). | Teachers can set up True/False once and have new questions inherit it; existing questions are not silently overwritten. | Two ways to set MC options (defaults + per-question), which the teacher must understand. |
| Compact (`small-input`, max-width 280px) type select. | Avoids the selector dominating the form; matches the form's modest density. | Less obvious affordance; mitigated by the field label and required marker. |
| Distraction-free (navbar hidden). | More vertical room for question editing; encourages focus. | Loss of in-app navigation; Cancel button is the only escape. |

## Scope (in)

Mirrors [`prd-5min.md`](./prd-5min.md) — two routes, two question types, Fast Create, unsaved-changes guard, default options, inline edit.

## Scope (out)

- No drag-to-reorder. The component does not own a drag library; ordering today is by add order + delete-and-re-add.
- No file attachments on questions.
- No multi-correct MC.
- No auto-save.
- No optimistic concurrency / conflict detection on edit save (last write wins).
