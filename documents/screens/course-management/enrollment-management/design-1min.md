---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Enrollment Management — Tech Design (1-min)

> Inline view of [Course Management](../design-1min.md). **No standalone route.** Replaces deprecated `/manage/enrollments` and `/manage/requests` (archived under `documents/_archive/`).

- **What we're building.** A standalone Angular component (`app-enrollment-management`) rendered inside the parent's content slot when the Enrollment nav is active. Receives `enrollments[]` from the parent; handles search, chip filter, pagination, and per-row actions internally.
- **Key decision: parent owns the source of truth, child owns transient state.** The full enrollment list lives in `app-course-management`. The child filters/paginates a *copy* and emits reconciliation events (`enrollmentUpdated`, `enrollmentRemoved`) so the parent's sidebar pending badge stays correct.
- **Key decision: chip filter (with pending count badge) instead of select dropdown.** A select hides the pending count behind a click; a chip surfaces it always.
- **Key decision: confirmation only for destructive/role mutations.** Approve and reject have no dialog (low cost to reverse). Role change and remove require confirmation.
- **Alternatives rejected.**
  - *Standalone screen at `/manage/enrollments`:* the original two-route flow (now archived) — pending requests went unnoticed.
  - *Server-side filter/pagination:* premature for current scale.
  - *Bulk actions:* deferred; not needed for v1.
- **Risk summary.** Stale parent list if reconciliation events are dropped, accidental role promotions (mitigated by dialog), hard-deletion of enrollments (no undo).
- **Code lives at.** `src/app/components/course-teacher/course-management/enrollment-management/`.

[5-min](./design-5min.md) · [Full](./design-full.md) · [Contract](./contract.yaml) · [PRD](./prd-1min.md) · [Parent](../design-1min.md)
