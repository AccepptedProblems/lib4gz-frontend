---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Enrollment Management — PRD (Full)

> Inherits problem, user, scope from [prd-5min.md](./prd-5min.md). Parent screen: [Course Management](../prd-full.md).

## Acceptance criteria

### Filter row

- Search input is compact (`max-width: 320px`, fluid below). Placeholder "Search by name or email...". Filters by `user.name` and `user.email` (case-insensitive, `includes`). Resets `page` to 1 on change.
- Status filter is a chip list (`lib-chip`) — replaces the older select dropdown. Chips: All (default), Active, Pending, Rejected, Inactive.
- Each chip uses semantic variant color: All=default, Active=success, Pending=warning, Rejected=error, Inactive=neutral.
- Pending chip displays a count badge (`pendingRequestCount`) when > 0.
- Only one chip selected at a time.

### Table

- Wrapper: `.table-wrapper` with horizontal overflow scroll.
- Columns: `#` (50px), Name, Email (`.col-email`, hidden below 768px), Role (color-coded `lib-badge` — primary for TEACHER, neutral for LEARNER), Status (`lib-badge` — success/warning/error/neutral by status), Joined (`mediumDate`, `—` if null), Actions (120px).
- Row hover: `--surface-hover`.
- Per-row actions:
  - **Status === PENDING:** `Approve` button (`primary sm`) and `Reject` button (`destructive sm`).
  - **Status !== PENDING:** Toggle Role icon-btn (`swap_horiz`) and Remove icon-btn (`person_remove`, `.icon-btn--danger`).
- Action buttons expose `aria-label` including the student name.

### Approve / Reject

- Approve calls `EnrollmentService.approve(id)`. On success: emit `enrollmentUpdated` with the updated row; toast "Enrollment approved".
- Reject calls `EnrollmentService.reject(id)`. On success: emit `enrollmentUpdated`; toast "Enrollment rejected".
- No confirmation dialog for approve/reject (PRD-level decision: low risk, easily reversible by re-approving or removing).

### Role change (with confirmation)

- Toggle Role opens `lib-dialog` with title "Change Role", `swap_horiz` icon, primary confirm variant, label "Change Role".
- Body shows: `Change <strong>{name}</strong>'s role to <lib-badge variant=…>{TARGET_ROLE}</lib-badge>?`
- Target role flips: LEARNER → TEACHER, TEACHER → LEARNER.
- Confirm calls `EnrollmentService.update(id, { role })`. On success: close dialog, emit `enrollmentUpdated`, toast "Role changed to {role}".

### Remove (with confirmation)

- Remove icon opens `lib-dialog` with title "Remove Enrollment", warning icon, destructive confirm variant, label "Remove".
- Body: `Are you sure you want to remove <strong>{name}</strong>? This will remove the student from the course.`
- Confirm calls `EnrollmentService.delete(id)`. On success: close dialog, emit `enrollmentRemoved` with id, toast "Enrollment removed".

### Pagination

- Page size: 20.
- Footer shows "Showing {start}–{end} of {total}" and `< {page} / {totalPages} >` controls.
- Prev/Next buttons disable at boundaries.
- `totalPages = ceil(filtered.length / 20) || 1`.

### Empty states

- No data + no filter: centered group icon + "No students enrolled yet. Share your course to get started."
- Filter active + no match: centered group icon + "No enrollments match your search/filter criteria."

## Edge cases

- **Filter narrows page beyond range.** When filter changes, `page` resets to 1. (Search and chip both reset.)
- **Pending count drops to 0 while Pending chip selected.** Filter still active, table empty; show empty-filtered state. User can click All.
- **Same id approved twice.** Backend returns the same ACTIVE row; UI emits `enrollmentUpdated` and parent dedupes by id — visually idempotent.
- **Joined date null.** Render `—`.
- **Email hidden on mobile.** Search still matches email; the column just isn't shown.
- **Role toggle while another mutation is in-flight.** Buttons don't disable globally; concurrent mutations are possible. Backend is authoritative; UI tolerates retries.

## Error states

- Approve / reject failure → error toast "Failed to approve/reject enrollment". Row stays as-is.
- Role change failure → error toast "Failed to change role"; dialog closes after `changingRole` flips back; row stays.
- Remove failure → error toast "Failed to remove enrollment"; dialog closes; row stays.
- No global error block — failures are mutation-scoped.

## Accessibility

- Wrapper `role="region"` + `aria-label="Enrollment management"`.
- Chip list `role="listbox"` + `aria-label="Filter by status"`.
- Table headers use `<th scope="col">`.
- Status badge uses `[ariaLabel]` with the status text for screen readers.
- Each row's action buttons include `aria-label` with the student's name.
- Both dialogs use `lib-dialog` modal semantics (focus trap, Esc closes, focus returns to trigger).
- Pagination buttons disable correctly so keyboard users can't activate them at boundaries.

[1-min](./prd-1min.md) · [5-min](./prd-5min.md) · [Tech design](./design-full.md) · [Parent screen](../prd-full.md)
