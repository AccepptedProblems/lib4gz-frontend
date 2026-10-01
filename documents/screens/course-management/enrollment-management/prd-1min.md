---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Enrollment Management — PRD (1-min)

> Inline view of [Course Management](../prd-1min.md). **No standalone route** — rendered when the teacher selects "Enrollment" in the parent's sidebar nav. Replaces the deprecated `/manage/enrollments` and `/manage/requests` routes (see `documents/_archive/enrollment-management/`, `documents/_archive/enrollment-requests/`).

- **Problem.** Teachers needed two pages — one for "all enrolled students" and one for "pending requests" — to triage and manage who's in their course. Pending counts were invisible from the rest of the management UI.
- **Primary user.** Course teacher inside `app-course-management`, after clicking the Enrollment nav item.
- **Outcome.** A single inline view (`app-enrollment-management`) with one table that supports search, status filter chips (with a pending count badge), pagination, and inline approve/reject/role/remove actions.
- **Why a child component.** Encapsulates filter, pagination, and dialog state so the parent stays focused on screen-level navigation and global pending count.
- **Success metric.** A teacher can locate and approve a pending request in fewer clicks than the previous two-route flow (target: 2 clicks from screen entry).
- **Scope (in).** Search, chip status filter, paginated table, role badges, approve/reject (PENDING), toggle role with confirmation (non-PENDING), remove with confirmation, parent-event emission for master list reconciliation.
- **Scope (out).** Bulk actions, server-side filtering/pagination (client-side is sufficient for current scale), invite-by-email, CSV export.
- **Lives at.** `src/app/components/course-teacher/course-management/enrollment-management/`.

[5-min](./prd-5min.md) · [Full](./prd-full.md) · [Tech design](./design-1min.md) · [Parent screen](../prd-1min.md)
