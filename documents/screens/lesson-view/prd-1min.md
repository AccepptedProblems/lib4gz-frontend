---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: per-release
---

# Lesson View — PRD (1 min)

- **Problem.** A student opening a lesson today lands on a placeholder. They can't read content, see where they are in the course, or move to the next lesson without going back to the dashboard.
- **Primary user.** Students enrolled in a course.
- **Outcome.** A student can open `/course/:courseId/lesson/:lessonId`, see the lesson title with a type badge (Reading / Video / Exercise / Quiz), consume the content, and step Previous/Next without leaving the page.
- **Success metric.** ≥80% of lesson opens result in either a Next-lesson click or a completion event in the same session.
- **Target date.** Aligned with course-dashboard read flow GA.
- **Status.** Scaffold — component exists, body is `lesson-view works!`.
- **Links.** [5-min PRD](./prd-5min.md) · [full PRD](./prd-full.md) · [tech design](./design-1min.md) · [contract](./contract.yaml)
