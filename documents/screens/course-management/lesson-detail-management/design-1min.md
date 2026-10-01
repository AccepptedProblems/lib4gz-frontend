---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Lesson Detail Management — Tech Design (1-min)

> Child component of [Course Management](../design-1min.md). No standalone route.

- **What we're building.** A standalone Angular component (`app-lesson-detail-management`) that, given a `lesson` input, fetches its summary and exercises and renders an inline editor experience for the lesson detail sub-view.
- **Key decision: self-contained data loading via `effect()`.** When the parent passes a new `lesson`, an `effect()` resets local signals and re-fetches summary + exercises. This keeps the parent free of summary/exercise state.
- **Key decision: inline summary editor instead of a separate screen.** Summary content is plain text; a `lib-textarea` with auto-resize is sufficient. A separate route for the editor adds a screen hop with no benefit.
- **Key decision: vertical exercise list, not a `<table>`.** Visual hierarchy reads better as rows with actions on the right; a 4-column table is over-engineered for ~5–20 exercises per lesson.
- **Alternatives rejected.**
  - *Parent owns summary state:* couples lesson editing into the already-large parent component.
  - *Modal for inline edit:* breaks the inline rhythm of the rest of the management hub.
  - *Pessimistic save:* spinner overlays everywhere; slows perceived performance.
- **Risk summary.** Linkify XSS surface (mitigated by pipe escaping), no unsaved-changes guard on back, summary `version` not surfaced (last-write-wins).
- **Code lives at.** `src/app/components/course-teacher/course-management/lesson-detail-management/`.

[5-min](./design-5min.md) · [Full](./design-full.md) · [Contract](./contract.yaml) · [PRD](./prd-1min.md) · [Parent](../design-1min.md)
