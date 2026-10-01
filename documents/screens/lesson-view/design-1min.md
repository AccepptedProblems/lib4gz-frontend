---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Lesson View — Tech Design (1 min)

- **What we're building.** A single standalone Angular component (`app-lesson-view`) at `/course/:courseId/lesson/:lessonId` that renders the lesson body, its sidebar (reused from the course dashboard), and Previous/Next nav.
- **Key decision: type-dispatched body.** The component renders the body via an `@switch` on `lesson.type`, mapping Summary → rich-text host, Video → player, Quiz → inline component, Exercise → router redirect. Rationale: keeps one route + one URL shape per lesson; alternative (separate route per type) was rejected because Prev/Next must work uniformly across types.
- **Key decision: client-side position math.** "Lesson X of Y" is computed from the `ModuleService.listByCourse(courseId)` payload we already fetch for the sidebar. Rationale: no new endpoint, no extra round-trip; alternative (server returns `{position, total}` with the lesson) was rejected as premature.
- **Key decision: Exercise redirects, not inline.** Avoids embedding a second app inside the lesson page; alternative (inline iframe) was rejected — submission state and routing would be tangled.
- **Risk summary.** Rich-text sanitization story is unsettled; video provider not yet picked; auto-complete hooks depend on the player choice.
- **Status.** Component scaffold exists at `src/app/components/course/lesson-view/`; body is `lesson-view works!`.

[5-min design](./design-5min.md) · [full design](./design-full.md) · [contract](./contract.yaml)
