---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Exercise Attempt — Tech Design (full)

This is the deep version. Read [design-1min](./design-1min.md) for the headline and [design-5min](./design-5min.md) for system context. This file expands on component structure, decision log, failure modes, and open questions.

The component lives at `src/app/components/course/exercise-attempt/exercise-attempt.component.{ts,html,scss}` and is the source of truth for shape and styles — this doc does not duplicate code.

## Component map

```
app-exercise-attempt (standalone)
├── header bar (inline)
│   ├── title text          ← "Exercise {prefix}"
│   ├── lib-button [Cancel] (secondary, md)
│   └── lib-button [Submit] (primary, md)
├── tab bar (inline, sticky under header)
│   ├── *ngFor: native button per exercise (role="tab")
│   └── Fast Fill button (native, pushed right with margin-left:auto)
├── tab content (role="tabpanel")
│   ├── exercise title (text-title-large)
│   └── *ngFor over activeQuestions()
│       ├── question number + content
│       └── answer input (switch on exercise.type)
│           ├── MULTIPLE_CHOICE: vertical radio group
│           └── TEXT_ANSWER: lib-textarea
├── lib-dialog [Submit Exercises]   (showSubmitDialog)
├── lib-dialog [Leave Exercise?]    (showCancelDialog)
└── lib-dialog [Fast Fill Answer]   (showFastFillDialog)
```

State containers and computed signals are listed in [design-5min](./design-5min.md#data-flow). The full inventory below repeats only what isn't there.

## Layout and styling notes

- Page is centered, `max-width 800px` on `>=768px`, full-width with 16px padding below 768px.
- **Sticky stack.** Header is `position: sticky; top: 0; z-index: 10`. Tab bar is `position: sticky; top: var(--header-bar-height, 57px); z-index: 9; background: var(--surface-page, #fff)`. Both share the page background — no border or surface change between sticky elements (per project design principles).
- **Tab buttons** must set `color` explicitly because `<button>` elements do not inherit text color. Active tab gets `color: var(--primary-color-600); border-bottom-color: var(--primary-color-600)`.
- **MC option highlight.** Selected option uses `background: var(--primary-color-50)` and `border-left: 3px solid var(--primary-color)`.
- **Question divider.** `border-bottom: 1px solid var(--neutral-color-2)` between questions; last question has none.
- Detailed token usage is in `documents/design-system/tokens.yaml` and the typography/color YAMLs — referenced from `contract.yaml`.

## Detailed flows

### Page load

1. Resolve route + query: `id`, `lessonId`, `prefix`.
2. `ExerciseService.listByLesson(lessonId)` → sort ascending by `orderIndex`.
3. `forkJoin` for each exercise:
   - `QuestionService.listByExercise(exerciseId)` → sort by `orderIndex`.
   - `SubmissionService.getMySubmission(exerciseId)` (404 → no prior attempt; map to empty).
4. Populate `questionsMap`, `answersMap` (any submission status, including `SUBMITTED` / `APPROVED` / `NEEDS_REVISION`), `submissionIds`.
5. `activeExerciseIndex = 0`; `screenState = 'loaded'`.

### Auto-save

- One `Subject<string>` named `save$` carrying `exerciseId`.
- `save$.pipe(debounceTime(2000))` → `saveDraft(exerciseId)`:
  1. Build `AnswerRequest[]` from `answersMap[exerciseId]`.
  2. `SubmissionService.createOrUpdate(exerciseId, { answers })`.
  3. On success: store `submissionId`, set `isDirty=false`.
  4. On error: surface a brief inline indicator; leave `isDirty=true` so the next change retries.
- Immediate save (no debounce) is invoked on tab switch and before opening Submit/Cancel dialogs.

### Submit

1. If `isDirty`, save all dirty drafts (await `forkJoin`).
2. Open `lib-dialog` titled `Submit Exercises`. Body computed from `answeredCount`, `totalQuestions`, `unansweredByExercise`.
3. On confirm, `isSubmitting=true`, then `forkJoin` of `SubmissionService.submit(submissionId)` for each exercise that has a `submissionId`.
4. All-success → close dialog, navigate to `/course/:id`.
5. Any error → close dialog, show error toast, stay on page (already-finalized exercises remain finalized server-side).

### Cancel

- `isDirty` → save all → open `Leave Exercise?` confirm dialog (destructive `Leave`, neutral `Stay`).
- Clean → navigate directly to `/course/:id`.

### Fast Fill (active exercise only)

- Open: reset `fastFillText=''`, `parsedAnswers=[]`, `showFastFillDialog=true`.
- Input: emit on `fastFillInput$`, `debounceTime(200)`, parse with regex `^\s*(\d+)\s*[.)]\s*`.
- Parse algorithm (mirrors `exercise-editor` Fast Create):
  1. Split input on newlines.
  2. For each line, test the regex.
  3. On match, flush the current buffer into `parsedAnswers`, start a new buffer with the post-prefix text.
  4. On no match, append the line to the current buffer (preserving multi-line answers).
  5. Trim each buffer; drop empty results.
- Distribute by position: `parsedAnswers[i] → activeQuestions()[i].id`.
- For `MULTIPLE_CHOICE`, case-insensitive match against `question.meta.options`. On match, store the canonical option text. On miss, store the raw parsed text (lets the student fix it later via the radio group).
- On confirm: set `isDirty=true`, trigger `save$`, close dialog.

## Decision log

| Date | Decision | Rationale | Alternatives |
|---|---|---|---|
| 2026-05-06 | Replace the `exercise-attempt` overview + `exercise-do` full-screen split with a single lesson-scoped tabbed screen. Old `exercise-do` is in `documents/_archive/exercise-do/`. | One Submit per lesson; no inter-screen navigation; matches dashboard hand-off. | Per-exercise screens, accordion, wizard — all rejected (see design-5min). |
| 2026-05-06 | Route changed to `/course/:id/lesson/:lessonId/attempt`. | Reflects that the screen is lesson-scoped, not exercise-scoped. | Keep `/course/:id/exercise/:exerciseId/attempt` — would force re-loading exercises across nav. |
| 2026-05-06 | Pass `prefix` (e.g. `1.2`) via query param from the dashboard. | The screen does not have a course/lesson hierarchy in scope; the dashboard already computed it. | Re-derive on this screen (would need the full course tree). |
| 2026-05-06 | Pre-populate answers from any submission status, not only `DRAFT`. | Continuity for re-attempts and review of `NEEDS_REVISION` work. | Only pre-populate `DRAFT` — would erase visible history for resubmitters. |
| 2026-05-06 | One Subject for auto-save (`save$`), separate Subject for Fast Fill parsing (`fastFillInput$`). | Different debounce windows (2s vs 200ms) and different intents (network call vs local parse). | Single shared subject with branching — muddy responsibilities. |
| 2026-05-06 | Sticky tab bar uses `top: var(--header-bar-height, 57px)`. | Constant works across header layout variations; cheap. | Measure header height on resize via `ResizeObserver` — extra complexity for marginal gain. |
| 2026-05-06 | Fast Fill applies only to the active exercise, not all exercises at once. | Avoids surprises when the same numbered list is misaligned across different exercise sizes. | Apply to all — too easy to mis-distribute. |
| 2026-05-06 | Submit fires `submit(submissionId)` per exercise in parallel. | All-or-nothing UX is simpler; partial failure is visible via toast. | Sequential with stop-on-error — slower, no clear win. |

## Failure modes

| Mode | Detection | UI | Recovery |
|---|---|---|---|
| `listByLesson` fails | HTTP error other than 404 | Full-page `error` state | Go Back to course dashboard |
| `listByExercise` fails for any exercise | HTTP error | Full-page `error` state | Go Back |
| `getMySubmission` returns 404 | Status 404 | Treated as empty draft, not error | n/a |
| `getMySubmission` returns other error | Non-404 HTTP error | Full-page `error` state | Go Back |
| Auto-save (`createOrUpdate`) fails | HTTP error | Inline indicator, keep `isDirty=true` | Next change retries |
| `submit` fails for one exercise | HTTP error inside `forkJoin` | Close dialog, error toast | Stay on page; student can retry Submit |
| Network down mid-typing | Save attempts queue and fail | Same as auto-save fail | Comes back online → next debounce retries |
| Empty lesson | `exercises.length === 0` | `no-exercises` placeholder | Go Back |
| `prefix` query param missing | `lessonPrefix === ''` | Header reads `Exercise` (no number) | n/a |
| MC Fast Fill match miss | Parsed text not in `options` (case-insensitive) | Raw text stored; radio renders no selection | Student fixes via radio click |

## Open questions

- **Analytics events.** Not enumerated in the original spec; needs PM input. Tracked in [prd-full](./prd-full.md#analytics-tbd).
- **Save indicator UX.** The original spec says "brief error indicator" without locating it. To be confirmed during implementation review (likely inline near the header).
- **Submit-with-zero-answers.** Currently allowed (the dialog warns and lists every exercise). Consider disabling Submit until at least one answer exists in a follow-up.
- **Tab keyboard semantics.** Spec mandates arrow-key navigation between tabs; verify focus management when switching tabs causes an immediate save.

## Reference paths

- Component: `src/app/components/course/exercise-attempt/`
- Route: `src/app/app.routes.ts` (under the `course/:id` parent route, `lesson/:lessonId/attempt`).
- Models: `src/app/shared/models/{exercise,question,submission}.model.ts` and `enums.ts`.
- Network references: `documents/network/api-endpoints.yaml`, `documents/network/models.yaml`.
- Design tokens: `documents/design-system/{tokens,color,typography}.yaml`.
- Archive of the deprecated `exercise-do` screen: `documents/_archive/exercise-do/`.

Links: [1-min](./design-1min.md) · [5-min](./design-5min.md) · [PRD full](./prd-full.md) · [contract](./contract.yaml)
