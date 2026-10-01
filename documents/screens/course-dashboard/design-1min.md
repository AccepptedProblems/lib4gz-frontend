---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Course Dashboard — Tech Design (1 min)

- **What we're building.** A standalone Angular component at `/course/:id` that renders a 280 px sidebar (course identity + module/lesson accordion) plus a centered content column (max-width 900 px) with three lazy tabs: Summary, Exercises, and (teacher-only) Submissions.
- **Key architectural decision.** **Single signal-based component, no child route per lesson.** Lesson selection lives in component state; the URL stays at `/course/:id`. Rejected: (a) child route per lesson — adds router work for what is in-component navigation; (b) NgRx store — overkill for one screen with no cross-screen state.
- **Second decision.** **Right-side `MatDrawer` with `mode="side"` (no overlay) for teacher per-question answers.** Rejected: dialog/modal — covers context; bottom sheet — bad fit on desktop.
- **Third decision.** **Hierarchical numbering is positional (`@for $index`), never persisted.** Rejected: storing `displayNumber` on entities — desyncs after reorder.
- **Risks.** (1) `forkJoin` over many submissions inside the drawer is a perf cliff for large classes. (2) Easy to violate the Unified Surface principle by adding `background-color` or `border-right` to the sidebar. (3) `mat-drawer-container` styling can leak into other screens if not scoped via `::ng-deep`.
- **Status.** scaffold — wireup of error/retry, focus management, and not-enrolled CTA still pending.
- **Links.** [design-5min.md](./design-5min.md) · [design-full.md](./design-full.md) · [contract.yaml](./contract.yaml)
