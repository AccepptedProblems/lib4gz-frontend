---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Course Dashboard — PRD (1 min)

- **Problem.** Enrolled students need a single place to navigate a course's modules and consume lesson content (summaries, exercises) without losing their place; teachers need the same view plus a way to inspect student submissions per question.
- **Primary user.** Enrolled student (LEARNER). Secondary: enrolled teacher (TEACHER) for the same course.
- **Outcome.** Persistent left sidebar shows course identity + collapsible module/lesson tree; content area shows the selected lesson with tabbed Summary / Exercises / (teacher-only) Submissions. One screen, no full-page reloads when changing lessons or tabs.
- **Success metric.** Time-to-first-lesson-content ≤ 2s on a warm cache; ≥ 80% of session lesson-switches happen via the sidebar (vs. browser back/forward) once shipped.
- **Target date.** TBD — currently `status: scaffold`.
- **Scope highlights.** Replaces the previous standalone course-header section; Coursera-style two-column layout. Mobile collapses sidebar into a drawer.
- **Out of scope (this iteration).** Search inside a course, lesson progress tracking/percentages, instructor messaging, reordering modules from this screen.
- **Links.** [prd-5min.md](./prd-5min.md) · [prd-full.md](./prd-full.md) · [design-1min.md](./design-1min.md) · [contract.yaml](./contract.yaml)
