---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Exercise Editor — Tech Design (full)

> Full version of the tech design. Audience: implementer + future maintainer. The 1-min and 5-min versions cover the main decision and data flow; this doc adds the component map, failure modes, the decision log with dates, and open questions.

## 1. Component map

All paths are relative to repo root.

| Region | Purpose | Source |
|---|---|---|
| Component class | Owns all signals, validation, save flow, navigation guard. | `src/app/components/course-teacher/exercise-editor/exercise-editor.component.ts` |
| Template | Render tree for loading / error / loaded states + 3 dialogs. | `src/app/components/course-teacher/exercise-editor/exercise-editor.component.html` |
| Styles | Layout, question card variants, answer chips, responsive. | `src/app/components/course-teacher/exercise-editor/exercise-editor.component.scss` |
| **Page header** (`.page-header`) | Title + Cancel/Save buttons in a single flex row. No back icon — Cancel handles navigation. | template § "Page header with Cancel/Save" |
| **Exercise metadata form** (`.form-section`) | `lib-textarea` for title; compact `<select>` for type; conditional Default Answers section. | template § "Exercise metadata form" |
| **Default Answers** (`.default-answers-section`) | Visible only for `MULTIPLE_CHOICE`. 2–6 radio + text rows; new questions inherit a clone. | template § "Default answers (placeholder) for MULTIPLE_CHOICE" |
| **Questions section** (`.questions-section`) | Header with count, question list, action row (`Add Question`, `Fast Create`). | template § "Questions section" |
| **Question card — view** (`.question-card--view`) | Compact read-only card; answer chips for MC, "(Text answer)" label for text. Edit / delete icon buttons. | template § "View mode" |
| **Question card — edit** (`.question-card--edit`) | Tinted (`--primary-color-50` bg, `--primary-color-200` border) inline editor: question textarea + (MC) answer rows + Save/Cancel. | template § "Edit mode" |
| **Fast Create dialog** | `lib-dialog` (600px) wrapping a `lib-textarea`. Confirm label is dynamic: "Add N Questions". | template § "Fast Create Dialog" |
| **Unsaved Changes dialog** | `lib-dialog` with destructive confirm ("Leave"). | template § "Unsaved Changes Dialog" |
| **Type Change dialog** | `lib-dialog` warning before wiping MC options on type switch. | template § "Type Change Confirmation Dialog" |
| **Loading state** | Skeleton blocks via `lib-skeleton` matching the form's geometry. | template § "Loading state (edit mode)" |
| **Error state** | Centered icon + message + Go Back button. | template § "Error state" |

### External pieces

| Dependency | Purpose | Path |
|---|---|---|
| `ExerciseService` | `get`, `create`, `update`. | `src/app/services/exercise.service.ts` |
| `QuestionService` | `listByExercise`, `batchUpdate` (CREATE/UPDATE/DELETE in one call). `batchCreate` is available but unused here — create flow uses inline questions on the exercise. | `src/app/services/question.service.ts` |
| `ToastService` | Success / error toasts. | `src/app/shared/components/toast/toast.component.ts` |
| Models | `ExerciseResponse`, `QuestionResponse`, `ExerciseType`, `QuestionAction`. | `src/app/shared/models/` |
| Shared components | `lib-button`, `lib-dialog`, `lib-skeleton`, `lib-textarea`. | `src/app/shared/components/` |
| Route registration | Lazy-loaded under the manage layout; `authGuard` + `roleGuard`. | `src/app/app.routes.ts` |
| Navbar suppression | `AppComponent.hiddenRoutes` includes the editor route patterns. | `src/app/app.component.ts` |

## 2. Failure modes

| Mode | Trigger | UI behaviour | State change |
|---|---|---|---|
| **Network down on init load (edit mode)** | `forkJoin` rejects. | `screenState = 'error'`. Show error icon + "Failed to load exercise. Please try again." + Go Back button. | No data is mutated. |
| **401 on init load** | JWT expired / missing. | Global `errorInterceptor` redirects to `/login`. Editor never reaches the loaded state. | — |
| **404 on init load** | `exerciseId` doesn't exist or teacher lacks access. | Same as network-down: error state. (Backend returns 4xx → forkJoin error path.) | — |
| **Empty exercise (no questions)** | Edit mode, exercise has 0 questions. | Loaded state with empty question list. Save is blocked by validation ("At least one question is required") until the teacher adds at least one. | — |
| **Save validation fails** | `validate()` returns false. | Inline error messages render (title, list-level, per-question). Save button stays enabled. No API call. | `isSaving` not set. |
| **Save fails (network / 5xx)** | `ExerciseService.update` or `QuestionService.batchUpdate` errors. | Toast "Failed to save exercise. Please try again." Stay on page. | `isSaving = false`. `isDirty` remains true. |
| **Partial save in edit mode** | `update` succeeds, then `batchUpdate` fails. | Same toast as above; the title/type are persisted on the server, the question diff is not. | `isSaving = false`. The next save retry will re-PATCH the exercise (idempotent) and re-attempt the diff. |
| **Missing `lessonId` on create-mode save** | Router state didn't carry it (e.g. teacher deep-linked to `/exercise/new`). | Toast "Lesson context is missing. Please go back and try again." | `isSaving = false`. No API call. |
| **`beforeunload` skipped** | Browser policy / no user interaction. | Dirty changes are lost. | Accepted. |
| **Diff falsely flags unchanged question** | `meta` key order differs between original and current. | Extra UPDATE call sent. Server result is identical. | No data corruption; minor traffic cost. |
| **Type switch with MC questions on screen** | Switch from MC → Text Answer (or vice versa) while questions exist. | Type Change dialog. On confirm, `meta` is reset uniformly across all questions. | All previously authored MC options are lost — by design. |

## 3. Decision log

| Date | Decision | Alternatives considered | Why |
|---|---|---|---|
| 2026-04 (TBD — original date predates this migration; verify via git) | One component for create + edit. | Two components sharing a base class. | State shapes are identical; doubling files would mean every change ships twice. |
| 2026-04 | Diff-on-save with `buildUpdateItems()` over JSON.stringify(meta). | Always-replace (delete all + recreate). | Preserves question IDs so future submission/answer references survive edits; smaller payloads. |
| 2026-04 | Fast Create uses a **single** delimiter regex (`^\s*\d+\s*[.)]\s*`). | Smart heuristics (blank-line, dash-as-bullet, AI-detect). | Predictable; teachers can paste chat / list / multi-line content without silent re-splitting. The cost (numbered headings inside content) is rare and easy to explain. |
| 2026-04 | Compact (`small-input`, max-width 280px) type select. | Standard full-width select; segmented control. | Avoids visual dominance; only two options means the dropdown is fast even when narrow. |
| 2026-04 | Inline edit (one card expanded) vs. modal. | Per-question modal. | Keeps neighbouring questions visible for context; faster scan-and-fix workflow. |
| 2026-04 | Cancel + Save in the page header (not a sticky footer). | Sticky bottom action bar. | Action buttons remain visible on long forms without taking permanent screen real estate; mobile already wraps gracefully. |
| 2026-04 | Default Answers section is **not** retroactive. | Apply edits to all existing MC questions. | Avoids silently overwriting deliberately-tuned questions. Trades a small amount of teacher work for safety. |
| 2026-04 | Navbar hidden on `/exercise/new` and `/exercise/:id/edit`. | Keep navbar visible. | Distraction-free editor; matches the modal-like nature of the task. |
| 2026-04 | `beforeunload` is best-effort; no custom message. | Show a custom warning. | Modern browsers ignore custom strings; default prompt is sufficient. |
| 2026-05-06 | Migrated documentation from a single `spec.yaml` to PRD + tech-design + contract per the new `_writing-guidelines.md`. | Keep the old spec. | Spec was 2651 lines; nobody read it. Three-version split forces compression. |

## 4. Open questions

- **Did the original spec ever articulate the user problem?** No. The source `spec.yaml` only described what the editor *does*, not who it serves or what they would otherwise do. The user problem in `prd-1min.md` / `prd-5min.md` is **inferred** from the teacher role + screen purpose. Validate with product before committing to the success metric.
- **Analytics events.** Source spec was silent. The proposed events in `prd-full.md` are TBD until product confirms.
- **Reorder support.** Has a teacher actually asked for drag-to-reorder yet, or is the current "delete and re-add" flow good enough?
- **Multi-correct MC.** Backend stores `meta.options[].isCorrect` as an array — the schema already supports multi-correct. Is there a roadmap for surfacing it?
- **Fast Create header collision.** Is "Section 1." inside a question (a real teacher pattern?) frequent enough to warrant an opt-out delimiter?
- **Snapshot performance.** `currentSnapshot` runs `JSON.stringify` on every keystroke (it's a `computed`). For a 100-question exercise this is fine but worth profiling once we see one in the wild.
- **Concurrent edits.** Two teachers editing the same exercise — last write wins, no warning. Does anyone need locking or merge?
