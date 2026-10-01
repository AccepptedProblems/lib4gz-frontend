---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: quarterly
---

# Archive

Retired screen specs. Kept for historical reference. **Do not implement from these — they are out of date by definition.**

| Folder | Replaced by | Date | Reason |
|---|---|---|---|
| `enrollment-management/` | `screens/course-management/` (Enrollment view) | 2026-03-09 | Merged into course-management as an inline sidebar view; standalone route `/course/:id/manage/enrollments` removed. |
| `enrollment-requests/` | `screens/course-management/` (Enrollment view) | 2026-03-09 | Folded into the same Enrollment inline view; standalone route `/course/:id/manage/requests` removed. |
| `exercise-do/` | `screens/exercise-attempt/` | 2026-03-12 | Exercise-doing UI merged into exercise-attempt's tabbed interface; route `/course/:id/exercise/:exerciseId/do` removed. |

Each folder retains its original `spec.yaml`. To find the current spec for any of these workflows, see the row's "Replaced by" column.
