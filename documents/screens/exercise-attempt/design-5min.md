---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Exercise Attempt — Tech Design (5 min)

## What we're building

A standalone Angular component (`app-exercise-attempt`) at the route `/course/:id/lesson/:lessonId/attempt`. It loads every exercise for a lesson and renders them as tabs; each tab shows the exercise's title and its questions with the appropriate answer UI. One Submit finalizes the whole lesson.

Component path: `src/app/components/course/exercise-attempt/exercise-attempt.component.{ts,html,scss}`.

## Key decision: lesson-scoped tabs (not one screen per exercise)

We consolidated two old screens — `exercise-attempt` (single-exercise overview) and `exercise-do` (full-screen do-it view, now in `documents/_archive/exercise-do/`) — into one screen scoped to a lesson. The route changed from `/course/:id/exercise/:exerciseId/attempt` to `/course/:id/lesson/:lessonId/attempt`.

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Lesson-scoped tabs (chosen)** | One Submit for the lesson; no inter-screen navigation; drafts shared in memory; matches the dashboard's mental model. | Loads all exercises up front. | Chosen. |
| Per-exercise screen (status quo) | Smaller initial fetch. | Multiple navigations per lesson; per-exercise submits feel disconnected; old `exercise-do` full-screen broke navbar continuity. | Rejected. |
| Accordion (one panel per exercise) | No tab UI. | Long pages on mobile; harder to find the active exercise. | Rejected. |
| Wizard / stepper | Familiar pattern. | Implies an order; we want random access. | Rejected. |

## System context

```
[Course Dashboard] --(click "Do Exercises", carries ?prefix=)--> [Exercise Attempt]
                                                                    |
                                  +---------------------------------+----------------------+
                                  v                                 v                      v
                          ExerciseService.listByLesson    QuestionService.listByExercise   SubmissionService.getMySubmission
                                                                                         (per exercise)
                          (auto-save)  --> SubmissionService.createOrUpdate
                          (Submit)     --> SubmissionService.submit (per exercise)
[Exercise Attempt] --(navigate /course/:id on Cancel/Submit success)--> [Course Dashboard]
```

- **Upstream.** Course dashboard hands off `lessonId`, `courseId`, and `prefix` (query param).
- **Downstream.** Submit and Cancel both navigate back to `/course/:id`.
- **Shared components.** `lib-button`, `lib-textarea`, `lib-dialog`, `lib-spinner`.

## Data flow

- **Signals**
  - `exercises: ExerciseResponse[]` — sorted by `orderIndex`.
  - `activeExerciseIndex: number` — drives both the tab UI and computed `activeExercise / activeQuestions / activeAnswers`.
  - `questionsMap: Map<exerciseId, QuestionResponse[]>`.
  - `answersMap: Map<exerciseId, Map<questionId, string>>` — local source of truth for student input.
  - `submissionIds: Map<exerciseId, string>`.
  - `isDirty`, `isSubmitting`, `screenState ∈ {loading, loaded, error}`, dialog visibility flags.
  - Fast Fill: `fastFillText: string`, `parsedAnswers: string[]`.
- **Subjects**
  - `save$: Subject<string>` (exerciseId) → `debounceTime(2000)` → `saveDraft(exerciseId)`.
  - `fastFillInput$: Subject<string>` → `debounceTime(200)` → parse → update `parsedAnswers`.
- **Computed**
  - `activeExercise`, `activeQuestions`, `activeAnswers`, `totalQuestions`, `answeredCount`, `unansweredCount`, `unansweredByExercise`, `headerTitle`.

### Init

1. Read route params (`id`, `lessonId`) and query (`prefix`).
2. `ExerciseService.listByLesson(lessonId)` → sort by `orderIndex`.
3. `forkJoin` per exercise: `listByExercise` + `getMySubmission` (treat 404 as empty).
4. Populate `questionsMap`, `answersMap` (from any-status submissions), `submissionIds`.
5. Set `activeExerciseIndex = 0`, `screenState = 'loaded'`.

### Save / submit

- **Auto-save**: any answer change → `save$.next(activeExerciseId)` → debounced `createOrUpdate` for that exercise → store returned `submissionId`, clear `isDirty`.
- **Tab switch**: if `isDirty`, immediate save before changing index.
- **Submit**: if `isDirty`, save-all first (await), then open confirmation dialog. On confirm, `submit(submissionId)` per exercise that has one, in parallel. Navigate on all-success.
- **Cancel**: if `isDirty`, save-all then open confirm; otherwise navigate.

## Tradeoffs

- **Up-front fetch cost** in exchange for instant tab switches and shared submit. We accept it because lessons typically have ≤5 exercises.
- **Two debounced subjects** (`save$`, `fastFillInput$`) instead of one — keeps responsibilities clear at the cost of a tiny duplication in setup.
- **Per-exercise submission rows on the server**, not one row per attempt. We pre-populate from any status to keep continuity, accepting that "previous answers" survive across attempts.
- **Sticky header relies on a magic number** (`--header-bar-height`, default 57px) for the tab-bar `top`. Easier than measuring at runtime; we revisit if the header layout changes.

## Scope

**In scope.** Tabbed lesson exercise UI, MC + text answers, auto-save, submit-all flow, cancel flow, Fast Fill for the active tab.

**Out of scope.** Other exercise types (`CODE`, `FILE_UPLOAD`, `PROJECT_LINK`), grading display, offline mode, time limits, analytics events.

## Failure modes (summary)

| Failure | UI behavior |
|---|---|
| List/exercise/question fetch fails | `error` state with `error_outline` + Go Back. |
| `getMySubmission` 404 | Treated as "no prior attempt", not an error. |
| Auto-save fails | Inline error indicator; `isDirty` stays true; retries on next change. |
| Submit fails for one exercise | Close dialog, error toast, stay on page. Successful exercises are finalized server-side. |
| Empty lesson | `no-exercises` placeholder + Go Back. |

Full decision log and per-failure detail in [design-full.md](./design-full.md).

Links: [1-min](./design-1min.md) · [full](./design-full.md) · [PRD 5-min](./prd-5min.md) · [contract](./contract.yaml)
