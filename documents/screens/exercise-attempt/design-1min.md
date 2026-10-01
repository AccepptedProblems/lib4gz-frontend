---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Exercise Attempt — Tech Design (1 min)

- **What we're building.** A standalone Angular component at `src/app/components/course/exercise-attempt/` that renders all of a lesson's exercises as tabs, with per-exercise answer maps, debounced auto-save, and a single Submit that finalizes every exercise.
- **Key decision.** **Lesson-scoped tabs**, not one screen per exercise. Replaces the deprecated split between `exercise-attempt` (overview) + `exercise-do` (full-screen). One route, one component, one Submit. Trades a small client-side memory cost (loading all questions up front) for a much shorter task flow. Alternatives rejected: keeping per-exercise routes (extra navigation, no shared submit), accordion (worse on mobile), wizard/stepper (forces sequence we don't want to enforce).
- **Architecture.** Standalone component, lazy-loaded via `loadComponent`. Signals + `forkJoin` for parallel loads. RxJS `Subject` + `debounceTime(2000)` for auto-save; second `Subject` + `debounceTime(200)` for Fast Fill parsing.
- **State shape.** `Map<exerciseId, Map<questionId, answer>>` for answers and `Map<exerciseId, submissionId>` for submission tracking. Keeps lookups O(1) and per-exercise saves clean.
- **Risks.** Sticky header height drift; large lessons increasing initial fetch time; Fast Fill mis-mapping for MC. All addressed in [design-full.md](./design-full.md).
- **Links.** [5-min design](./design-5min.md) · [full design](./design-full.md) · [contract](./contract.yaml) · [PRD 1-min](./prd-1min.md)
