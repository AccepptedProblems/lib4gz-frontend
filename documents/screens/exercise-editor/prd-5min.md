---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Exercise Editor — PRD (5-min)

## Problem

Teachers need to attach a graded set of questions to a lesson. The platform supports two answer formats — **Multiple Choice** (one correct option from up to 6) and **Text Answer** (free-form student response). Authoring a 10-question exercise one record at a time is the dominant workflow today; it is slow, repetitive, and discourages teachers from converting their existing question banks (often kept as numbered text in Docs / Word / Notion).

## Primary user

A **teacher** signed in with the `teacher` role, working from a lesson's management screen, who wants to either:

- create a brand-new exercise for the lesson, or
- revise an existing exercise (fix typos, swap a question, change the correct answer).

## Outcome

One full-screen editor handles both flows. The teacher writes a title, picks a type, builds questions inline, and saves once. A **Fast Create** shortcut lets them paste a numbered list and convert it to questions in a single step.

## Success metric

- Median time to publish a 10-question exercise **< 3 minutes** (TBD — source spec did not specify).
- **> 40% of newly created exercises** use Fast Create within 30 days (TBD).
- Save error rate **< 1%** of attempts.

## User stories

| # | Story |
|---|---|
| US-1 | As a teacher, I can create a new exercise from a lesson and add questions one at a time. |
| US-2 | As a teacher, I can paste a numbered list of questions from an external doc and have them converted into individual questions in one step. |
| US-3 | As a teacher, I can edit an existing exercise and change only the questions that need to change. |
| US-4 | As a teacher, I can switch the exercise type and the editor adapts the question UI accordingly. |
| US-5 | As a teacher, I am protected from losing work if I accidentally navigate away mid-edit. |
| US-6 | As a teacher, I can set a default set of answer choices (e.g. True/False) once and have every new MC question inherit them. |

## Scope (in)

- Two routes (create + edit) handled by one component.
- Two exercise types: `MULTIPLE_CHOICE`, `TEXT_ANSWER`.
- Inline per-question edit (one question expanded at a time).
- Fast Create bulk import — the **only** delimiter is a numbered index at line start (`^\s*\d+\s*[.)]\s*`); everything else is preserved verbatim inside the question.
- Unsaved-changes confirmation (button cancel, route guard, browser `beforeunload`).
- Type-change confirmation when switching away from MC with options already filled.
- Default answer options at the exercise level (placeholder for new MC questions).
- Distraction-free layout (navbar hidden on these routes).
- Diff-on-save in edit mode: unchanged questions are not sent to the API.

## Scope (out — not this iteration)

- **Drag-to-reorder questions.** Order today is fixed by creation order + delete-and-re-add.
- **Image / audio / file attachments** on questions.
- **Multi-correct MC** (more than one correct answer).
- **Per-question scoring weights** (every question is currently scored equally by the grader).
- **AI-assisted question generation.**
- **Bulk import of MC options** (Fast Create only handles question text; options come from the exercise-level defaults).
- **Auto-save / draft recovery.** Recovery is via the unsaved-changes dialog only.

## Key assumptions

- A lesson context (`lessonId`) is always available — passed through router state from the lesson management screen. If absent on save, save fails with a toast (no fallback).
- Backend endpoints `exercises.*` and `questions.*` (see [`network/api-endpoints.yaml`](../../network/api-endpoints.yaml)) are stable; the diff-on-save contract relies on `questions.batch-update` accepting CREATE / UPDATE / DELETE actions in one call.
- Teachers work primarily on desktop. Mobile is supported (>360px) but not optimized for heavy authoring.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Teachers expect Fast Create to also import answer choices, not just question text. | Medium | Documented in placeholder text and the Default Answers feature. Revisit if support tickets recur. |
| Diff algorithm in `buildUpdateItems()` falsely flags an unchanged question as changed (e.g. because key order in `meta` differs). | Medium | Diff uses `JSON.stringify(meta)`; a stable serialization is assumed. Add a regression test if drift appears. |
| Browser `beforeunload` is only honoured if the user has interacted with the page; on quick close it may be skipped. | Low | Accepted — in-app guard covers the primary navigation case. |
| Type switch silently wipes MC options for *all* questions, even ones the teacher considered final. | Medium | Confirmation dialog before applying. |

## Dependencies

- `ExerciseService` (`src/app/services/exercise.service.ts`) and `QuestionService` (`src/app/services/question.service.ts`).
- Shared components: `lib-button`, `lib-dialog`, `lib-textarea`, `lib-skeleton`, `lib-toast` (`ToastService`).
- Lesson management screen for the back-navigation contract (it passes `lessonId` in router state).
- Auth + role guards (`authGuard`, `roleGuard` with `roles: ['teacher']`).
