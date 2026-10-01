---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Summary View — PRD (1 min)

- **Problem.** Students opening a lesson have nowhere to read the lesson's written content (text, images, embedded media). The component exists as a scaffold but isn't wired up.
- **Primary user.** Enrolled student (LEARNER) reading lesson material.
- **Outcome.** Inside a course, picking a lesson loads its summary as a centered, readable column with prev/next-lesson navigation and a Mark Complete toggle.
- **Success metric.** ≥ 95% of lesson opens render summary content within 1s on warm cache; navigation between adjacent lessons keeps users in-page (no full reload).
- **Status.** Scaffold — component file exists, route not yet registered in `app.routes.ts`.
- **Scope highlights.** Render sanitized HTML/Markdown summary; auto-linkify plain URLs; Prev / Next / Mark Complete footer; reuse the course sidebar from the parent layout.
- **Out of scope (this iteration).** Authoring/editing content (teacher-side), inline comments/annotations, automatic completion (manual toggle only), real progress percentages.
- **Open questions.** Backend endpoint for "mark lesson complete" is not yet defined — see [prd-full.md](./prd-full.md) risks.
- **Links.** [prd-5min.md](./prd-5min.md) · [prd-full.md](./prd-full.md) · [design-1min.md](./design-1min.md) · [contract.yaml](./contract.yaml)
