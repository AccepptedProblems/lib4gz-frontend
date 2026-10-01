---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Exercise Attempt — PRD (1 min)

- **Problem.** A lesson can have multiple exercises, but the old flow forced students through a separate overview page and a full-screen "do" view per exercise. Switching between exercises in the same lesson took multiple navigations and lost context.
- **User.** Students working through a lesson's exercises.
- **Outcome.** One screen at `/course/:id/lesson/:lessonId/attempt` loads every exercise in the lesson and surfaces them as tabs. Header shows position prefix (e.g. `Exercise 1.2`) plus Cancel and Submit. Answers auto-save as drafts; Submit confirms and finalizes all exercises at once.
- **Why now.** Replaces the `exercise-do` full-screen flow (archived in `documents/_archive/exercise-do/`) and the old single-exercise attempt overview.
- **Success metric.** Median time from "open lesson exercises" to "submit all" drops; share of submissions with all questions answered increases.
- **Target date.** Current release.
- **Links.** [5-min PRD](./prd-5min.md) · [full PRD](./prd-full.md) · [tech design](./design-1min.md) · [contract](./contract.yaml)
