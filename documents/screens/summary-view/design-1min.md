---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Summary View — Tech Design (1 min)

- **What we're building.** A standalone Angular component that fetches and renders a lesson summary plus Prev / Next / Mark Complete controls. Rendered inside the existing course layout (sidebar + breadcrumb host).
- **Key decision: render inside parent course layout, not as a standalone page.** The course sidebar, breadcrumb, and mobile drawer already live in `course-layout.component`. `summary-view` is content-only, slotted via `<router-outlet>`. *Alternatives rejected:* (a) duplicating the sidebar inside summary-view (drift, double fetches); (b) making summary-view replace `course-lesson.component` outright (couples this scaffold work to a larger refactor).
- **Key decision: manual Mark Complete only.** Auto-completion (scroll/dwell) is out of scope; the scaffold blocks on "no `lessons.complete` endpoint" — track as risk, ship the UI behind a feature flag if needed.
- **Data flow.** `SummaryService.get(lessonId)` for content, `LessonService.get(lessonId)` for metadata + completion flag, parent layout already has `ModuleService.listByCourse(courseId)` for the navigation tree (consume via shared signal/service, do not re-fetch).
- **Sanitization.** HTML sanitized via Angular's `DomSanitizer` + existing `LinkifyPipe` for plain URLs. External links: `target="_blank" rel="noopener noreferrer"`.
- **Risks.** Missing `lessons.complete` endpoint; route shape disagreement between source spec and current router (`/course/:id/lesson/:lessonId` vs. spec's `…/summary` suffix). Resolve before implementation.
- **Links.** [design-5min.md](./design-5min.md) · [design-full.md](./design-full.md) · [contract.yaml](./contract.yaml) · [prd-1min.md](./prd-1min.md)
