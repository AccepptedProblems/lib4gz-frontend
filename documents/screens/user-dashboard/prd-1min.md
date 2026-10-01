---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# User Dashboard — PRD (1 min)

- **Problem.** After login, users have no central place to see their courses; without it, they can't resume learning or jump into the courses they teach.
- **Primary user.** Authenticated learners (student role) and instructors (teacher role). Both land here at `/`.
- **Outcome.** One landing screen that lists every course the user is enrolled in or teaches, plus a code-based lookup to enroll in new courses.
- **Key capability.** Tabbed view — *My Courses* (enrolled) and *Teaching* (taught). The Teaching tab is visible to everyone, but only TEACHER/ADMIN see *+ Create Course* on it.
- **Code search.** Top-right input lets users find a course by its 10-digit code: enrolled match → navigate; non-enrolled match → preview-and-apply dialog; no match → inline "Course not found".
- **Success metric.** ≥ 90% of authenticated sessions reach a course within two clicks of login.
- **Target date.** Scaffold milestone — see openspec phase index.
- **Status.** Scaffold (real progress %, thumbnails, last-activity timestamp deferred).
- **Reads more.** [`prd-5min.md`](./prd-5min.md), [`prd-full.md`](./prd-full.md), [`design-1min.md`](./design-1min.md), [`contract.yaml`](./contract.yaml).
