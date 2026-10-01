---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Exercise Attempt — PRD (5 min)

## Problem

A lesson can contain several exercises. The old UX split work across two screens — an "attempt overview" per exercise and a separate full-screen "do" view — so doing the lesson's homework meant repeatedly bouncing back to the course dashboard. Students lost track of which exercises they'd touched and how many questions remained.

## Users and outcome

- **Primary user.** Student in an enrolled course.
- **Outcome.** A single focused screen for completing every exercise in one lesson. Tabs make it obvious how many exercises exist and let the student jump between them. Answers persist as drafts automatically; one Submit finalizes the whole lesson.

## User stories

1. As a student, I open a lesson's exercises from the dashboard and land on a screen that already shows me every exercise in that lesson as a tab.
2. As a student, I switch between exercises without losing answers I already filled in.
3. As a student, I see my header context (`Exercise 1.2`) so I know which lesson I'm in.
4. As a student returning to a draft, my previous answers are pre-filled.
5. As a student, I paste a numbered list of answers ("Fast Fill") to fill the active exercise quickly.
6. As a student, when I click Submit I see a per-exercise breakdown of unanswered questions before confirming.
7. As a student, if I click Cancel with unsaved work, my draft is saved before I'm asked to leave.

## Scope

**In scope**
- Route `/course/:id/lesson/:lessonId/attempt` (lesson-scoped, not exercise-scoped).
- Load all exercises for the lesson + their questions + any existing submission (any status) in parallel.
- Tab UI per exercise, sorted by `orderIndex`. Tab labels are `Exercise {1-based index}`.
- Two answer types: `MULTIPLE_CHOICE` (radio group) and `TEXT_ANSWER` (`lib-textarea`).
- Auto-save drafts (2s debounce) + immediate save on tab switch / before Submit.
- Submit confirmation dialog with answered/total count and per-exercise unanswered breakdown.
- Cancel confirmation dialog when there are unsaved changes.
- Fast Fill Answer dialog scoped to the active exercise tab.
- Header with position prefix from the dashboard (e.g. `Exercise 1.2`), passed via `?prefix=` query param.

**Out of scope (this iteration)**
- Other exercise types (`CODE`, `FILE_UPLOAD`, `PROJECT_LINK`) — render later.
- Per-question feedback or grading display — handled by the `summary-view` screen after Submit.
- Time-limited attempts / proctoring.
- Offline mode.

## Key assumptions

- The course dashboard is the only entry point and supplies the `prefix` query param. If absent, header reads just `Exercise`.
- A lesson has at least one exercise. The empty-state placeholder is a defensive fallback, not a normal flow.
- `SubmissionService.getMySubmission` returns 404 for "no prior attempt" — that is expected, not an error.

## Risks

- **Cross-exercise auto-save volume.** A student switching tabs frequently can fire many `createOrUpdate` calls. Mitigation: debounce 2s, immediate save only on tab switch / Submit, single submission per exercise (`createOrUpdate` is idempotent on the server side).
- **Fast Fill mis-mapping for MC.** Pasted text may not match any option. Mitigation: case-insensitive match with fallback to raw string so the student can correct.
- **Sticky-header height drift.** Tab bar's `top` must match the header's rendered height. Mitigation: documented constant (`--header-bar-height`, default 57px); revisit if header layout changes.

## Dependencies

- `ExerciseService.listByLesson`, `QuestionService.listByExercise`, `SubmissionService.getMySubmission | createOrUpdate | submit`.
- Shared components: `lib-button`, `lib-textarea`, `lib-dialog`, `lib-spinner`.
- Course dashboard hands off `prefix` query param.

## Success metrics

- Time-to-submit (open → final Submit) for a lesson with N exercises drops vs the old two-screen flow.
- Submissions where all questions are answered increase as % of total submissions.
- Auto-save error rate stays under 1% of save attempts.

Links: [1-min PRD](./prd-1min.md) · [full PRD](./prd-full.md) · [tech design 5-min](./design-5min.md) · [contract](./contract.yaml)
